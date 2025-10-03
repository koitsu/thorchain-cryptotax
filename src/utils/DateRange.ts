export interface DateRange {
    from: string;
    to: string;
}

function isIsoDateString(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValid(date: Date): boolean{
    return !isNaN(date.getTime());
}

class DateParts {
    year: number;
    month: number;
    day: number;

    constructor(date: string) {
        const [year, month, day] = date.split("-").map(n => parseInt(n, 10));
        this.year = year;
        this.month = month;
        this.day = day;
    }

    toUTCDate(): Date {
        return new Date(Date.UTC(this.year, this.month - 1, this.day));
    }

    toString(): string {
        return this.toUTCDate().toISOString().slice(0, 10);
    }

    clone(): DateParts {
        return new DateParts(this.toString());
    }

    // Converts to UTC date so facilitates month overflow, and day 0 rolling back to previous month
    static toDateParts(year: number, month: number, day: number): DateParts {
        return new DateParts(new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10));
    }

    lastDayOfMonth(): DateParts {
        // Day 0 of next month = last day of this month
        return DateParts.toDateParts(this.year, this.month + 1, 0);
    }

    addDays(days: number): DateParts {
        return DateParts.toDateParts(this.year, this.month, this.day + days);
    }

    addYears(years: number): DateParts {
        return DateParts.toDateParts(this.year + years, this.month, this.day);
    }

    isAfter(other: DateParts) {
        return this.toUTCDate().getTime() > other.toUTCDate().getTime();
    }
}

/**
 * Generates an array of date ranges between `fromDate` and `toDate`.
 * Only accepts ISO date strings - YYYY-MM-DD.
 *
 * monthly: calendar month boundaries
 * yearly:  12-month blocks starting from fromDate
 */
export function generateDateRanges(
    fromDate: string,
    toDate: string,
    frequency: "monthly" | "yearly" | "none"
): DateRange[] {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    if (!isIsoDateString(fromDate) || !isValid(startDate)) {
        throw new Error("Invalid fromDate");
    }

    if (!isIsoDateString(toDate) || !isValid(endDate)) {
        throw new Error("Invalid toDate");
    }

    if (startDate > endDate) {
        throw new Error("fromDate must be earlier than toDate");
    }

    const ranges: DateRange[] = [];

    const start: DateParts = new DateParts(fromDate);
    const end: DateParts = new DateParts(toDate);

    if (frequency === 'none') {
        return [{from: start.toString(), to: end.toString()}];
    }

    let periodStart: DateParts = start;
    let periodEnd: DateParts;

    while (!periodStart.isAfter(end)) {
        if (frequency === 'monthly') {
            periodEnd = periodStart.lastDayOfMonth();
        } else {
            // yearly
            periodEnd = periodStart.addYears(1).addDays(-1);
        }

        if (periodEnd.isAfter(end)) {
            periodEnd = end.clone();
        }

        ranges.push({from: periodStart.toString(), to: periodEnd.toString()});

        // Move to the next day after periodEnd
        periodStart = periodEnd.addDays(1);
    }

    return ranges;
}
