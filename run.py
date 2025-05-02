from waitress import serve
from dma_prime_vis_toolkit import create_app

import logging
from logging.handlers import TimedRotatingFileHandler
import os

formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

handler = TimedRotatingFileHandler(os.path.join('C:/Users/Grace/Documents/CDC Project/DMA-PRIME-DASHBOARD/testing/logs', 'dmaprime.log'), 
                        when='midnight', backupCount=7)
handler.setLevel(logging.INFO)
handler.setFormatter(formatter)

logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Create the app instance with parameters
app = create_app(dataDir="C:/DMA-PRIME/data")

# Run the app using Waitress
serve(app, host='0.0.0.0', port=8080)
