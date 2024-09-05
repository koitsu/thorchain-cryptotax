import {describe, expect, test} from '@jest/globals';
import {generateDateRanges} from "../src/utils/DateRange";

describe('generateDateRanges', () => {
    test('yearly', () => {
        const ranges = generateDateRanges('2020-01-01', '2023-12-31', 'yearly');

        expect(ranges).toStrictEqual([
            {
                "from": "2020-01-01",
                "to": "2020-12-31"
            },
            {
                "from": "2021-01-01",
                "to": "2021-12-31"
            },
            {
                "from": "2022-01-01",
                "to": "2022-12-31"
            },
            {
                "from": "2023-01-01",
                "to": "2023-12-31"
            }
        ]);
    });

    test('monthly', () => {
        const ranges = generateDateRanges('2020-01-01', '2021-03-31', 'monthly');

        expect(ranges).toStrictEqual([
            {
                "from": "2020-01-01",
                "to": "2020-01-31"
            },
            {
                "from": "2020-02-01",
                "to": "2020-02-29"
            },
            {
                "from": "2020-03-01",
                "to": "2020-03-31"
            },
            {
                "from": "2020-04-01",
                "to": "2020-04-30"
            },
            {
                "from": "2020-05-01",
                "to": "2020-05-31"
            },
            {
                "from": "2020-06-01",
                "to": "2020-06-30"
            },
            {
                "from": "2020-07-01",
                "to": "2020-07-31"
            },
            {
                "from": "2020-08-01",
                "to": "2020-08-31"
            },
            {
                "from": "2020-09-01",
                "to": "2020-09-30"
            },
            {
                "from": "2020-10-01",
                "to": "2020-10-31"
            },
            {
                "from": "2020-11-01",
                "to": "2020-11-30"
            },
            {
                "from": "2020-12-01",
                "to": "2020-12-31"
            },
            {
                "from": "2021-01-01",
                "to": "2021-01-31"
            },
            {
                "from": "2021-02-01",
                "to": "2021-02-28"
            },
            {
                "from": "2021-03-01",
                "to": "2021-03-31"
            }
        ]);
    });

    test('none', () => {
        const ranges = generateDateRanges('2020-01-01', '2021-03-31', 'none');

        expect(ranges).toStrictEqual([
            {
                "from": "2020-01-01",
                "to": "2021-03-31"
            }
        ]);
    });
});
