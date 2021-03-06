// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as util from 'util';
import { Aborter, MessageIdURL, MessagesURL, Models, QueueURL } from '@azure/storage-queue';
import { QueueRuntimeConfig, RetryHelper, ServiceConfiguration } from 'common';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { ContextAwareLogger } from 'logger';
import { iocTypeNames, MessageIdURLProvider, MessagesURLProvider, QueueServiceURLProvider, QueueURLProvider } from '../ioc-types';
import { Message } from './message';

@injectable()
export class Queue {
    constructor(
        @inject(iocTypeNames.QueueServiceURLProvider) private readonly queueServiceURLProvider: QueueServiceURLProvider,
        @inject(iocTypeNames.QueueURLProvider) private readonly queueURLProvider: QueueURLProvider,
        @inject(iocTypeNames.MessagesURLProvider) private readonly messagesURLProvider: MessagesURLProvider,
        @inject(iocTypeNames.MessageIdURLProvider) private readonly messageIdURLProvider: MessageIdURLProvider,
        @inject(ServiceConfiguration) private readonly serviceConfig: ServiceConfiguration,
        @inject(ContextAwareLogger) private readonly logger: ContextAwareLogger,
        @inject(RetryHelper) private readonly retryHelper: RetryHelper<void>,
        private readonly maxEnqueueRetryCount: number = 3,
        private readonly retryIntervalMilliseconds: number = 1000,
    ) {}

    /**
     * @param numberOfMessages - number of messages to dequeue. Maximum supported is 32 per call (limited by Azure storage service)
     */
    public async getMessages(queue: string, numberOfMessages: number = 32): Promise<Message[]> {
        const maxDequeueCount = (await this.getQueueConfig()).maxDequeueCount;
        const messages: Message[] = [];
        const queueURL = await this.getQueueURL(queue);
        const deadQueueURL = await this.getQueueURL(`${queue}-dead`);

        await this.ensureQueueExists(queueURL);
        await this.ensureQueueExists(deadQueueURL);

        const serverMessages = await this.getQueueMessages(queueURL, numberOfMessages);
        for (const serverMessage of serverMessages) {
            if (serverMessage.dequeueCount > maxDequeueCount) {
                await this.moveToDeadQueue(queueURL, deadQueueURL, serverMessage);

                this.logger.logWarn(
                    `Storage queue message ${serverMessage.messageId} exceeded dequeue threshold of ${maxDequeueCount} and moved to the ${queue}-dead queue.`,
                );
            } else {
                messages.push(new Message(serverMessage.messageText, serverMessage.messageId, serverMessage.popReceipt));
            }
        }

        return messages;
    }

    public async getMessagesWithTotalCount(queue: string, totalMessagesCount: number): Promise<Message[]> {
        const messages: Message[] = [];
        do {
            const remainingMessagesCount = totalMessagesCount - messages.length;
            const currentBatchCount = remainingMessagesCount > 32 ? 32 : remainingMessagesCount;
            const batch = await this.getMessages(queue, currentBatchCount);

            if (batch.length === 0) {
                break;
            }
            messages.push(...batch);
        } while (messages.length < totalMessagesCount);

        return messages;
    }

    public async deleteMessage(queue: string, message: Message): Promise<void> {
        const queueURL = await this.getQueueURL(queue);

        return this.deleteQueueMessage(queueURL, message.messageId, message.popReceipt);
    }

    public async createMessage(queue: string, message: unknown): Promise<boolean> {
        try {
            await this.tryCreateMessage(queue, message);

            return true;
        } catch (error) {
            this.logger.logError(`Failed to create message in a queue storage: ${util.inspect(message)}. Error: ${util.inspect(error)}`);

            return false;
        }
    }

    public async getMessageCount(queue: string): Promise<number> {
        const queueURL = await this.getQueueURL(queue);
        const queueProperties = await queueURL.getProperties(Aborter.none);

        return queueProperties.approximateMessagesCount;
    }

    public async createQueueMessage(queueURL: QueueURL, message: unknown): Promise<unknown> {
        const messagesURL = this.getMessagesURL(queueURL);

        const response = await messagesURL.enqueue(Aborter.none, JSON.stringify(message));
        if (_.isNil(response) || _.isNil(response.messageId)) {
            throw new Error(`Enqueue failed with response: ${util.inspect(response)}`);
        }

        return message;
    }

    private async tryCreateMessage(queue: string, message: unknown): Promise<void> {
        return this.retryHelper.executeWithRetries(
            async () => {
                const queueURL = await this.getQueueURL(queue);
                await this.ensureQueueExists(queueURL);
                await this.createQueueMessage(queueURL, message);
            },
            async (error: Error) => {
                return;
            },
            this.maxEnqueueRetryCount,
            this.retryIntervalMilliseconds,
        );
    }

    private async ensureQueueExists(queueURL: QueueURL): Promise<void> {
        try {
            await queueURL.getProperties(Aborter.none);
        } catch {
            await queueURL.create(Aborter.none);
        }
    }

    private async deleteQueueMessage(queueURL: QueueURL, messageId: string, popReceipt: string): Promise<void> {
        const messagesURL = this.getMessagesURL(queueURL);
        const messageIdURL = this.getMessageIdURL(messagesURL, messageId);

        await messageIdURL.delete(Aborter.none, popReceipt);
    }

    private async getQueueMessages(queueURL: QueueURL, numberOfMessages: number): Promise<Models.DequeuedMessageItem[]> {
        const messageVisibilityTimeoutInSeconds = (await this.getQueueConfig()).messageVisibilityTimeoutInSeconds;
        const requestOptions: Models.MessagesDequeueOptionalParams = {
            numberOfMessages,
            visibilitytimeout: messageVisibilityTimeoutInSeconds,
        };

        await this.ensureQueueExists(queueURL);

        const messagesURL = this.getMessagesURL(queueURL);

        const response = await messagesURL.dequeue(Aborter.none, requestOptions);

        return response.dequeuedMessageItems;
    }

    private async moveToDeadQueue(
        originQueueURL: QueueURL,
        deadQueueURL: QueueURL,
        queueMessage: Models.DequeuedMessageItem,
    ): Promise<void> {
        await this.createQueueMessage(deadQueueURL, queueMessage.messageText);
        await this.deleteQueueMessage(originQueueURL, queueMessage.messageId, queueMessage.popReceipt);
    }

    private getMessagesURL(queueURL: QueueURL): MessagesURL {
        return this.messagesURLProvider(queueURL);
    }

    private getMessageIdURL(messageURL: MessagesURL, messageId: string): MessageIdURL {
        return this.messageIdURLProvider(messageURL, messageId);
    }

    private async getQueueURL(queueName: string): Promise<QueueURL> {
        const serviceURL = await this.queueServiceURLProvider();

        return this.queueURLProvider(serviceURL, queueName);
    }

    private async getQueueConfig(): Promise<QueueRuntimeConfig> {
        return this.serviceConfig.getConfigValue('queueConfig');
    }
}
