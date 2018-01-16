// Load json data files.
/* eslint-disable global-require */
const dataFiles = [
  'viber_attacked_by_syrian_electronic_army-cropped',
  'one_paragraph-ampersand_nonexistent',
  'one_paragraph-ampersand',
  'one_paragraph-ampersand_escaped',
];
const data = dataFiles.map(d => require(`../etc/data/${d}.json`).html);
/* eslint-enable global-require */

// Constants
const counts = {
  the: 46,
  viber: 22,
  a: 285,
};

// Tests available
const tests = {
  standard: {
    text:
      'Viber has now clarified that the hack only allowed access to two' +
      ' minor systems, a customer support panel and a support' +
      ' administration system. According to the company’s official' +
      ' response, “no sensitive user data was exposed and Viber’s databases' +
      ' were not ‘hacked’.”',
    xpath: {
      start: { offset: 0, xpath: '/p[3]/a/text()[1]' },
      end: { offset: 260, xpath: '/p[3]/text()[1]' },
    },
  },
  wrapElement: {
    text: 'the Viber support page, though',
    xpath: {
      start: { xpath: '/p[2]/text()[1]', offset: 47 },
      end: { xpath: '/p[2]/text()[2]:8', offset: 8 },
    },
  },
  multiElement: {
    text:
      'dashboard, not a database. Viber also took the opportunity to' +
      ' respond to accusations of spying:Viber, like many other companies' +
      ' such as Microsoft, Cisco, Google, and Intel maintains a development' +
      ' center in Israel. It seems like this caused some people to come up' +
      ' with some pretty bizarre conspiracy theories.It goes without' +
      ' saying, that these claims are completely without merit, and have no' +
      ' basis in reality whatsoever.Viber is a free messaging and calling' +
      ' service based out of London, with development centers in Israel,' +
      ' with over 200 million users globally.Update — Viber has followed up' +
      ' with more details',
    xpath: {
      start: { xpath: '/p[10]/text()[1]', offset: 337 },
      end: { xpath: '/p[13]/strong/text()[1]:', offset: 48 },
    },
  },
  bottomup: {
    text: ' support page, though it',
    xpath: {
      start: { xpath: '/p[2]/a[2]/text()', offset: 5 },
      end: { xpath: '/p[2]/text()[2]', offset: 11 },
    },
  },
  uppercase: {
    text: 'Spot originally',
    xpath: {
      start: { xpath: '/p[2]/a/text()[1]', offset: 5 },
      end: { xpath: '/p[2]/text()[1]', offset: 11 },
    },
  },
  'wampersand-&': {
    text:
      'Army (a pro-government group of computer hackers aligned with' +
      ' Syrian President Bashar al-Assad) & the world cried foul',
    xpath: {
      start: { xpath: '/p[1]/code[1]/text()[1]', offset: 18 },
      end: { xpath: '/p[1]/text()[4]', offset: 114 },
    },
  },
  'sampersand-&': {
    text: '& the world cried foul',
    xpath: {
      start: { xpath: '/p[1]/text()[4]', offset: 92 },
      end: { xpath: '/p[1]/text()[4]', offset: 114 },
    },
  },
  'eampersand-&': {
    text:
      'Army (a pro-government group of computer hackers aligned with' +
      ' Syrian President Bashar al-Assad) &',
    xpath: {
      start: { xpath: '/p[1]/code[1]/text()[1]', offset: 18 },
      end: { xpath: '/p[1]/text()[4]', offset: 93 },
    },
  },
  'wampersand-n': {
    text:
      'Army (a pro-government group of computer hackers aligned with' +
      ' Syrian President Bashar al-Assad) n the world cried foul',
    xpath: {
      start: { xpath: '/p[1]/code[1]/text()[1]', offset: 18 },
      end: { xpath: '/p[1]/text()[4]', offset: 114 },
    },
  },
  'sampersand-n': {
    text: 'n the world cried foul',
    xpath: {
      start: { xpath: '/p[1]/text()[4]', offset: 92 },
      end: { xpath: '/p[1]/text()[4]', offset: 114 },
    },
  },
  'eampersand-n': {
    text:
      'Army (a pro-government group of computer hackers aligned with' +
      ' Syrian President Bashar al-Assad) n',
    xpath: {
      start: { xpath: '/p[1]/code[1]/text()[1]', offset: 18 },
      end: { xpath: '/p[1]/text()[4]', offset: 93 },
    },
  },
};

export { data, counts, tests };