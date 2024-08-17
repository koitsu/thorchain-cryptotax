import json
from cryptocmd import CmcScraper


# pip3 install -r requirements.txt

def dump_all(coin, path):
    print('Get historical data for ' + coin)

    scraper = CmcScraper(coin)
    json_data = scraper.get_data("json")

    parsed = json.loads(json_data)
    js = 'const data = ' + json.dumps(parsed, indent=4) + ';'
    js += '\n'
    js += 'export default data;'

    save(js, path + '/' + coin + '.ts')


def save(text, file):
    text_file = open(file, "w")
    text_file.write(text)
    text_file.close()


coins = [
    'BTC',
    'DOGE',
    'RUNE',
    'ETH',
    'ATOM',
    'AVAX',
    'BUSD',
    'BNB'
]

if __name__ == '__main__':
    for coin in coins:
        dump_all(coin, 'data')
