// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';

@injectable()
export class RuleExclusion {
    public accessibilityRuleExclusionList = [
        'image-redundant-alt',
        'empty-heading',
        'p-as-heading',
        'table-duplicate-name',
        'table-fake-caption',
        'td-has-header',
        'link-in-text-block',
        'meta-viewport-large',
        'tabindex',
        'scope-attr-valid',
        'frame-title-unique',
        'heading-order',
        'hidden-content',
        'label-title-only',
        'region',
        'skip-link',
        'landmark-main-is-top-level',
        'landmark-one-main',
        'focus-order-semantics',
        'frame-tested',
        'landmark-banner-is-top-level',
        'landmark-contentinfo-is-top-level',
        'landmark-no-duplicate-banner',
        'landmark-no-duplicate-contentinfo',
        'link-name', // accessibility-insights-service issue #976
        'page-has-heading-one',
        'aria-allowed-role',
        'css-orientation-lock',
        'form-field-multiple-labels',
        'label-content-name-mismatch',
        'landmark-complementary-is-top-level',
        'scrollable-region-focusable',
        'landmark-unique',
        'meta-viewport',
        'accesskeys',
        'landmark-no-duplicate-main',
        'identical-links-same-purpose',
    ];
}
