import {format} from 'date-fns';
import atomPrices from './data/ATOM';
import avaxPrices from './data/AVAX';
import bnbPrices from './data/BNB';
import btcPrices from './data/BTC';
import busdPrices from './data/BUSD';
import dogePrices from './data/DOGE';
import ethPrices from './data/ETH';
import runePrices from './data/RUNE';

function mapData(items: any) {
    return items.reduce((previousValue: any, currentValue: any): any => {
        previousValue[currentValue.Date] = currentValue.Close + '';
        return previousValue;
    }, {});
}

const allData: any = {
    ATOM: mapData(atomPrices),
    AVAX: mapData(avaxPrices),
    BNB: mapData(bnbPrices),
    BTC: mapData(btcPrices),
    BUSD: mapData(busdPrices),
    DOGE: mapData(dogePrices),
    ETH: mapData(ethPrices),
    RUNE: mapData(runePrices),
};

export function getPrice(coin: string, date: Date) {
    const dateStr: string = format(date, 'dd-MM-yyyy');

    if (!allData[coin]) {
        throw Error(`no prices for ${coin}`);
    }

    const price = allData[coin][dateStr];

    if (typeof price === 'undefined') {
        throw Error(`price not found for ${coin} on ${dateStr}`);
    }

    return price;
}

function test() {
    console.log(getPrice('RUNE', new Date(2020, 0, 1)));
}

// test();
