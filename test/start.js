/* eslint-disable import/unambiguous */

const context = require.context('../src/', true, /\.test\.js$/);
context.keys().forEach(context);

export default context;
