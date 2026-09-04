import { colorForRoll, rgbToHex } from '../utils/colors.js';

// ============ DICE ROLL ============
// Rolls a d20 and gives the page a subtle, temporary color wash based on
// the result -- purely cosmetic, no game mechanics attached to it.
const ROLL_FLAVOR = {
  1: 'Critical failure...', 2: 'Ouch.', 3: 'Rough one.', 4: 'Not great.', 5: 'Meh.',
  6: 'Could be worse.', 7: 'Shrug.', 8: 'Middling.', 9: 'Passable.', 10: 'Even odds.',
  11: 'Decent.', 12: 'Solid.', 13: 'Pretty good.', 14: 'Nice roll!', 15: 'Great roll!',
  16: 'Excellent!', 17: 'Fantastic!', 18: 'Superb!', 19: 'Almost perfect!', 20: 'CRITICAL HIT!',
};

const d20Btn = document.getElementById('d20Btn');
const d20FaceText = document.getElementById('d20FaceText');
const d20Result = document.getElementById('d20Result');
const d20RollNum = document.getElementById('d20RollNum');
const d20RollLabel = document.getElementById('d20RollLabel');
let rolling = false;

d20Btn.addEventListener('click', () => {
  if (rolling) return;
  rolling = true;
  d20Btn.classList.add('rolling');
  d20Result.classList.remove('show');

  let ticks = 0;
  const flicker = setInterval(() => {
    d20FaceText.textContent = String(1 + Math.floor(Math.random() * 20));
    ticks++;
    if (ticks > 8) clearInterval(flicker);
  }, 60);

  setTimeout(() => {
    clearInterval(flicker);
    const roll = 1 + Math.floor(Math.random() * 20);
    d20FaceText.textContent = String(roll);
    d20Btn.classList.remove('rolling');
    rolling = false;

    d20RollNum.textContent = roll;
    d20RollLabel.textContent = ROLL_FLAVOR[roll];
    d20RollNum.style.color = colorForRoll(roll).startsWith('rgb') ? rgbToHex(colorForRoll(roll)) : colorForRoll(roll);
    d20Result.classList.add('show');

    document.body.style.backgroundColor = colorForRoll(roll);
  }, 620);
});
