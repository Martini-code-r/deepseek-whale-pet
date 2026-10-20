'use strict';

// `npm run smoke` launches the app in screenshot mode and exits when done.
process.argv.push('--smoke');
require('./start.js');
