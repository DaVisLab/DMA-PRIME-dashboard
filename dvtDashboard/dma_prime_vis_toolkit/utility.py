main_dir = "/".join(__file__.split("\\")[:-1])

files = {
    'covid-19': [{'file': main_dir+'/static/data/covid-19_zcta_data_11_11_24.csv', 'imputation': False, 'date_format': "%Y-%m-%d"},
                    {'file': main_dir+'/static/data/covid-19_zcta_data_imputation_11_11_24.csv', 'imputation': True, 'date_format': "%d/%m/%y"}
                    ],
    'influenza-1': [{'file': main_dir+'/static/data/influenza-1.1_zcta_data_11_11_24.csv', 'imputation': False, 'date_format': "%Y-%m-%d"},
                    {'file': main_dir+'/static/data/influenza-1.1_zcta_data_imputation_11_11_24.csv', 'imputation': True, 'date_format': "%d/%m/%y"}
                    ],
}