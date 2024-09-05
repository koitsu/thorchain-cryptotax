
export interface DateRange {
    from: string;
    to: string;
}

function toDateString(d: Date) {
    return d.toISOString().substring(0, 10);
}

export function generateDateRanges(fromDate: string | number | Date,
                                   toDate: string | number | Date,
                                   frequency: 'monthly' | 'yearly' | 'none'): DateRange[] {
    let ranges = [];
    let start = new Date(fromDate);
    let end = new Date(toDate);

    if (start > end) {
        throw new Error("fromDate should be earlier than toDate");
    }

    if (frequency === 'none') {
        return [{
            from: toDateString(start),
            to: toDateString(end)
        }];
    }

    while (start <= end) {
        let periodEnd = new Date(start);

        if (frequency === 'monthly') {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        periodEnd.setDate(periodEnd.getDate() - 1);

        if (periodEnd > end) {
            periodEnd = end;
        }

        ranges.push({
            from: toDateString(start),
            to: toDateString(periodEnd)
        });

        start = periodEnd;
        start.setDate(start.getDate() + 1); // Move to the next day
    }

    return ranges;
}
