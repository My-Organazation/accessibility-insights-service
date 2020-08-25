// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import Apify from 'apify';
import { Url } from 'common';
import * as fs from 'fs';
import { injectable } from 'inversify';
import { ApifySettingsHandler, apifySettingsHandler } from '../apify/apify-settings';
import { ResourceCreator } from '../types/resource-creator';

@injectable()
export class ApifyResourceCreator implements ResourceCreator {
    private readonly requestQueueName = 'scanRequests';

    public constructor(
        private readonly urlObj: typeof Url = Url,
        private readonly apify: typeof Apify = Apify,
        private readonly settingsHandler: ApifySettingsHandler = apifySettingsHandler,
        private readonly filesystem: typeof fs = fs,
    ) {}

    public async createRequestQueue(baseUrl: string, empty?: boolean): Promise<Apify.RequestQueue> {
        if (empty === true) {
            this.clearRequestQueue();
        }

        const requestQueue = await this.apify.openRequestQueue(this.requestQueueName);
        await requestQueue.addRequest({ url: this.urlObj.getRootUrl(baseUrl) });

        return requestQueue;
    }

    public async createRequestList(existingUrls: string[]): Promise<Apify.RequestList> {
        return this.apify.openRequestList('existingUrls', existingUrls === undefined ? [] : existingUrls);
    }

    private clearRequestQueue(): void {
        const outputDir = this.settingsHandler.getApifySettings().APIFY_LOCAL_STORAGE_DIR;
        // tslint:disable-next-line: non-literal-fs-path
        if (this.filesystem.existsSync(outputDir)) {
            // tslint:disable-next-line: non-literal-fs-path
            this.filesystem.rmdirSync(outputDir, { recursive: true });
        }
    }
}