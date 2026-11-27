'use strict';

const skills = ['Listening', 'Reading', 'Writing', 'Speaking'];
const partCounts = { Listening: 4, Reading: 3, Writing: 2, Speaking: 3 };
const partLabels = { Listening: 'Part', Reading: 'Passage', Writing: 'Task', Speaking: 'Part' };
const answerKeys = {
  Listening: [
    'DW30 7YZ|DW307YZ','24 April|24th April|April 24|April 24th','dentist','parking','Claxby','late','evening','supermarket','pollution','storage',
    'C','A','A','B','E','B','G','D','A','F',
    'A','B','A','C','B','A','B','E','A','C',
    'fences','family','helicopters','stress','sides','breathing','feet','employment','weapons','tourism'
  ],
  Reading: [
    'lettuces','1,000 kg|1000 kg|1,000kg|1000kg','consumption|food consumption','pesticides','journeys','producers','flavour|flavor','TRUE','NOT GIVEN','FALSE','TRUE','FALSE','NOT GIVEN',
    'B','A','C','E','B','B','C','C','fire','nutrients','cavities','hawthorn','rare',
    'C','F','A','E','B','sustainability','fuel','explosions','bankrupt','C','D','B','D','A'
  ]
};
const ranges = { Listening: [[1,10],[11,20],[21,30],[31,40]], Reading: [[1,13],[14,26],[27,40]] };
function normalize(value) {
  return String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
}
function scorePart(skill, part, answers) {
  const [first,last] = ranges[skill][part-1];
  let correct = 0, answered = 0;
  const review = [];
  for (let n = first; n <= last; n++) {
    const paired = skill === 'Listening' && [14,27,29].includes(n);
    if (paired) {
      const response = answers['q'+n+'-'+(n+1)] || [];
      const choices = [...new Set(Array.isArray(response) ? response.map(normalize).filter(Boolean) : [])].slice(0,2);
      const expected = answerKeys[skill].slice(n-1,n+1);
      const points = expected.filter(key => choices.includes(normalize(key))).length;
      answered += choices.length;
      correct += points;
      review.push({question:n+'–'+(n+1),response:choices.join(', ').toUpperCase(),key:expected.join(', '),points,max:2});
      n++;
    } else {
      const response = String(answers['q'+n] || '');
      const variants = answerKeys[skill][n-1].split('|');
      const points = Number(variants.map(normalize).includes(normalize(response)));
      if (normalize(response)) answered++;
      correct += points;
      review.push({question:String(n),response,key:variants.join(' / '),points,max:1});
    }
  }
  return {correct,answered,total:last-first+1,review};
}
