import { describe, expect, test } from '@jest/globals';
import { generateDateRanges } from "./DateRange";

describe("generateDateRanges", () => {
    test("should throw if no fromDate is provided", () => {
        expect(() => generateDateRanges(undefined as any, "2025-01-01", "monthly"))
            .toThrow("Invalid fromDate");
    });

    test("should throw if no toDate is provided", () => {
        expect(() => generateDateRanges("2025-01-01", undefined as any, "monthly"))
            .toThrow("Invalid toDate");
    });

    test("should throw if fromDate is later than toDate", () => {
        expect(() => generateDateRanges("2025-05-01", "2025-01-01", "monthly"))
            .toThrow("fromDate must be earlier than toDate");
    });

    test("should throw if fromDate is invalid", () => {
        expect(() => generateDateRanges("not-a-date", "2025-01-01", "monthly"))
            .toThrow("Invalid fromDate");
    });

    test("should throw if toDate is invalid", () => {
        expect(() => generateDateRanges("2025-01-01", "not-a-date", "monthly"))
            .toThrow("Invalid toDate");
    });

    test("should return a single range when frequency is 'none'", () => {
        const ranges = generateDateRanges("2025-01-01", "2025-01-10", "none");
        expect(ranges).toEqual([
            { from: "2025-01-01", to: "2025-01-10" }
        ]);
    });

    test("should generate monthly ranges", () => {
        const ranges = generateDateRanges("2025-01-01", "2025-03-31", "monthly");
        expect(ranges).toEqual([
            { from: "2025-01-01", to: "2025-01-31" },
            { from: "2025-02-01", to: "2025-02-28" },
            { from: "2025-03-01", to: "2025-03-31" }
        ]);
    });

    test("should handle end-of-month start dates correctly", () => {
        const ranges = generateDateRanges("2025-01-31", "2025-03-15", "monthly");
        expect(ranges).toEqual([
            { from: "2025-01-31", to: "2025-01-31" },
            { from: "2025-02-01", to: "2025-02-28" },
            { from: "2025-03-01", to: "2025-03-15" }
        ]);
    });

    test("should generate yearly ranges as 12-month blocks from start date", () => {
        const ranges = generateDateRanges("2024-07-01", "2026-02-15", "yearly");
        expect(ranges).toEqual([
            { from: "2024-07-01", to: "2025-06-30" },
            { from: "2025-07-01", to: "2026-02-15" }
        ]);
    });

    test("should handle end-of-month start dates correctly for yearly", () => {
        const ranges = generateDateRanges("2025-01-31", "2026-03-15", "yearly");
        expect(ranges).toEqual([
            { from: "2025-01-31", to: "2026-01-30" },
            { from: "2026-01-31", to: "2026-03-15" }
        ]);
    });

    test("should handle leap year correctly in yearly ranges", () => {
        const ranges = generateDateRanges("2023-03-01", "2024-08-15", "yearly");
        expect(ranges).toEqual([
            { from: "2023-03-01", to: "2024-02-29" }, // 2024 is leap year
            { from: "2024-03-01", to: "2024-08-15" }
        ]);
    });

    test("should handle multiple full 12-month blocks", () => {
        const ranges = generateDateRanges("2020-05-10", "2023-07-05", "yearly");
        expect(ranges).toEqual([
            { from: "2020-05-10", to: "2021-05-09" },
            { from: "2021-05-10", to: "2022-05-09" },
            { from: "2022-05-10", to: "2023-05-09" },
            { from: "2023-05-10", to: "2023-07-05" } // partial final period
        ]);
    });
});
