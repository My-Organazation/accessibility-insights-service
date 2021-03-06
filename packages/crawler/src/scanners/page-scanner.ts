// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { AxePuppeteer } from '@axe-core/puppeteer';
import { Report, ReporterFactory } from 'accessibility-insights-report';
import { AxeResults } from 'axe-core';
import { inject, injectable } from 'inversify';
import { Page } from 'puppeteer';
import { AxePuppeteerFactory } from 'scanner-global-library';
import { iocTypes } from '../types/ioc-types';

export interface ScanResult {
    axeResults: AxeResults;
    report?: Report;
}

@injectable()
export class PageScanner {
    public constructor(
        @inject(iocTypes.ReporterFactory) private readonly reporterFactory: ReporterFactory,
        @inject(AxePuppeteerFactory) private readonly axePuppeteerFactory: AxePuppeteerFactory,
    ) {}

    public async scan(page: Page): Promise<ScanResult> {
        const axePuppeteer: AxePuppeteer = await this.axePuppeteerFactory.createAxePuppeteer(page);
        const axeResults = await axePuppeteer.analyze();

        const report = this.createReport(axeResults, page.url(), await page.title());

        return {
            axeResults,
            report,
        };
    }

    private createReport(axeResults: AxeResults, url: string, title: string): Report {
        const reporter = this.reporterFactory();

        return reporter.fromAxeResult({
            results: axeResults,
            serviceName: 'Accessibility Insights CLI',
            description: `Automated report for accessibility scan of URL ${url}`,
            scanContext: {
                pageTitle: title,
            },
        });
    }
}
