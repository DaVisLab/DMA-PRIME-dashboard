import pandas as pd

main_dir = "/".join(__file__.split("\\")[:-1])

counties = [
    'abbeville',
    'aiken',
    'allendale',
    'anderson',
    'bamberg',
    'barnwell',
    'beaufort',
    'berkeley',
    'calhoun',
    'charleston',
    'cherokee',
    'chester',
    'chesterfield',
    'clarendon',
    'colleton',
    'darlington',
    'dillon',
    'dorchester',
    'edgefield',
    'fairfield',
    'florence',
    'georgetown',
    'greenville',
    'greenwood',
    'hampton',
    'horry',
    'jasper',
    'kershaw',
    'lancaster',
    'laurens',
    'lee',
    'lexington',
    'mccormick',
    'marion',
    'marlboro',
    'newberry',
    'oconee',
    'orangeburg',
    'pickens',
    'richland',
    'saluda',
    'spartanburg',
    'sumter',
    'union',
    'williamsburg',
    'york',
]

def input_parser(input):
    if isinstance(input, list):
        return input
    if isinstance(input, str):
        if input == 'all':
            return slice(None)
        elif input == 'max':
            return input
    return [input]
    

def parse_date(date):
    # returns the monday of whatever week the date that is passed in belongs to
    pd_date = pd.Timestamp(date, tz=None).tz_localize(None).round('d')

    return pd_date - pd.DateOffset(pd_date.dayofweek, 'd')
