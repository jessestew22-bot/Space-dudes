// ---------- SCRIPT: every story line in one place ----------
// Lines are [speaker, text, mood?]. Speakers: crew ids, 'P' (player), 'O' (the captured one),
// 'narr', or 'radio:<speaker>'. W = who you play ('jesse' | 'ian').
//
// Story spine (keep every scene consistent with it):
// - Four of the five went down in the dropship. The player missed the launch (J: his AI booked it
//   for Thursday; Ian: busy sneaking the hockey tape into J's bunk).
// - Something grabbed the dropship; it crashed, the crew split up, and the dropship's 3 fuel cells
//   scattered. The player lands the STARSTANG after them, and that landing burns its fuel.
// - Rescues: Rich (stuck in goo, gives his boots), E (fighting bugs, tunes your blaster),
//   Big T (on an acid island, shares his remedy). The other main guy is held in the hive.
// - The crew only goes into the hive once: whole crew, full tank. Then the queen, then the
//   planet goes critical and everyone climbs the shaft to the ship.
const pick = (W, j, i) => (W === 'jesse' ? j : i);

const SCRIPT = {
  intro: (W, O) => [
    ['narr', 'Orbit of KELSO-7. The salvage ship STARSTANG 5.0.'],
    ['narr', '0600. The dropship heads down to the surface with four of the crew. There are five on the roster.'],
    ...pick(W,
      [['jesse', 'My AI put the launch on my calendar for Thursday.'], ['jesse', 'It\'s Tuesday. My AI says the crew left early. Rude.']],
      [['ian', 'I was busy.'], ['ian', '...Returning something. Don\'t ask.'], ['narr', 'He was sneaking a VHS tape into J\'s bunk. It took forty minutes.']]),
    ['narr', '0614. The radio crackles.'],
    ['radio:richie', 'DUDE. DUDE! Something just GRABBED the dropship! We\'re going DOWN!', 'yell'],
    ['radio:bigt', 'BROWN TOWN IS GOING DOWN TOWN!!', 'yell'],
    ['narr', 'Static. Nothing for two hours. Then one more message.'],
    ...pick(W,
      [['radio:ian', '...It\'s Ian. We crashed. Everybody got split up. Something big dragged me underground.'],
       ['radio:ian', 'The dropship\'s fuel cells blew all over the place. You\'ll want those. Bring snacks.']],
      [['radio:jesse', 'It\'s J! We crashed, everybody split up, and something HUGE dragged me underground!', 'yell'],
       ['radio:jesse', 'The fuel cells are scattered everywhere. My AI says I\'m fine. My AI is not down here.']]),
    ['narr', 'Signal lost.'],
    ...pick(W,
      [['jesse', 'Okay. Solo rescue. My AI gives me 73.6 percent.'], ['jesse', '...It rounded up.']],
      [['ian', 'Great. Love that for me.']]),
    ['narr', 'You take the STARSTANG down after them. The landing burns most of the fuel.'],
  ],
  mission: (W, O) => ['MISSION', `Find RICH, E and BIG T. Find the dropship's 3 FUEL CELLS so the STARSTANG can make orbit. Then go get ${CREW[O].name}.`],

  cliff: W => pick(W,
    [['jesse', 'My AI says I can make that jump.'], ['jesse', '...My AI has been wrong before. I need more jump.']],
    [['ian', 'Wall. Tall. Cool.'], ['ian', 'I\'m gonna need more jump than I\'ve got.']]),

  richie: W => [
    ['richie', 'AAAH! DUDE! Don\'t SNEAK up on me!', 'yell'],
    ...pick(W,
      [['jesse', 'RICH, LOOK OUT!'], ['richie', '...There\'s nothing there, dude.'], ['jesse', 'Because I just saved your life. Again.']],
      [['ian', 'You\'re glued to a wall with alien snot, Rich.'], ['richie', 'It\'s GOO, dude. Totally different.'], ['ian', 'Sure.']]),
    ['narr', 'You peel Rich out of the goo.'],
    ['richie', 'When that thing grabbed me I jumped SO hard I jumped twice. In midair.'],
    ['richie', 'Turns out these space boots do that. Here. You take \'em. I\'m done jumping for today.'],
    ['P', 'What are you gonna wear?'],
    ['richie', 'Space socks, dude.'],
    ['richie', 'And FYI, rescues are free. I don\'t owe you five bucks for this.', 'smirk'],
  ],
  richieGift: ['JUMPY BOOTS', 'Press JUMP again in midair to double jump. Rich wants them back. Eventually.'],

  eli: W => [
    ['eli', 'Oh great. It\'s the rescue-party brothers. Party of one.'],
    ['eli', 'About time. I\'ve been holding off space bugs with a sword for two hours.'],
    ...pick(W,
      [['jesse', 'My AI says swords are 80 percent of space combat.'], ['eli', 'Your AI is right. Don\'t tell it I said that.']],
      [['ian', 'Why did you bring a sword to space?'], ['eli', 'Why DIDN\'T you?']]),
    ['eli', 'Hand me your blaster.'],
    ['narr', 'E taps it twice with the flat of his sword. It starts to hum.'],
    ['eli', 'ANIME DRAW. Hold the trigger. Feel it. Let go.'],
    ['eli', 'That\'s the whole lesson. Purple crystal breaks if you mean it.'],
  ],
  eliGift: ['ANIME DRAW', 'Hold FIRE to charge, let go to blast. Charged shots shatter purple crystal. Hold DOWN while charging to blast the floor.'],

  bigt: W => [
    ['bigt', 'BROWN TOWN, BABY! You found me!', 'yell'],
    ['P', pick(W, 'Big T! How\'d you even get out here?', 'You\'re on an island. In acid.')],
    ['bigt', 'Walked. Through the acid. I\'ve been drinking my own remedy all day.'],
    ['bigt', 'Packed it from my bathroom cabinet before we launched. Here. Your turn.'],
    ...pick(W,
      [['jesse', 'My AI says that\'s forty percent cough syrup.'], ['bigt', 'And SIXTY percent COURAGE!', 'yell']],
      [['ian', '...The label says "not for internal use."'], ['bigt', 'I SAID DON\'T READ THE LABEL!', 'yell']]),
    ['P', 'So why didn\'t you just walk out?'],
    ['bigt', 'I was WAITING for you. It\'s called LOYALTY.'],
  ],
  bigtGift: ['BATHROOM CABINET', 'Acid can\'t hurt you now. Energy refilled. Don\'t ask what was in it.'],

  fuel: (n, crewDone, O) => [`FUEL CELL ${n}/3`,
    n < 3 ? 'The STARSTANG needs three to make orbit.'
      : crewDone ? `Tank's full and the crew's together. Time to go get ${CREW[O].name}.` : 'Tank\'s full. Now round up the rest of the crew.'],

  tape: W => pick(W, [
    ['jesse', 'Is that...'],
    ['jesse', 'SPORTS PAGES VOL. 46. FANTASTIC HOCKEY FIGHTS.'],
    ['narr', 'A sticky note on the case: "Thought this was far enough. -I"'],
    ['jesse', 'Ian brought this on the dropship. Just to hide it from me. On a different PLANET.'],
    ['jesse', '...I\'m keeping it. Out of spite.'],
  ], [
    ['ian', 'No.'],
    ['ian', 'SPORTS PAGES VOL. 46. I put this in J\'s bunk this MORNING.'],
    ['narr', 'A sticky note on the case: "Nice try. -J"'],
    ['ian', 'He took it on the dropship. To an alien planet. To give it BACK.'],
    ['ian', '...Respect. Still not keeping it.'],
  ]),
  tapeGift: ['SECRET: THE TAPE', 'It\'s riding home with you. Whether anyone likes it or not.'],

  gateFirst: (W, O) => [
    ['P', pick(W, 'Ian\'s in there. Gotta be.', 'J\'s in there. I can hear him narrating.')],
    ['P', 'We only go in once: whole crew, full tank, then straight back out.'],
  ],
  gateOpen: (W, O) => [
    ['bigt', 'That door is BREATHING. Doors don\'t BREATHE.'],
    ...pick(W,
      [['radio:ian', '...Guys. I can hear you through the door. Open the door.']],
      [['radio:jesse', 'GUYS! I can hear you! My AI says the door is friendly!'], ['eli', 'It\'s not friendly.']]),
    ['richie', 'Okay. Everybody shoot it on three. One, two...'],
    ['richie', 'AAH!', 'yell'],
    ['narr', 'Rich fires early. Then everybody does. The door gives up.'],
  ],

  boss: (W, O) => [
    ['narr', 'Something enormous unfolds from the ceiling.'],
    [O, pick(W, 'Over here. In the goo. Again.', 'HI GUYS! Over here! In the goo!')],
    ['richie', 'DUDE. DUDE. IT\'S HUGE.', 'yell'],
    ['bigt', 'She\'s ugly AND she took our guy. That\'s two strikes.'],
    ['eli', 'Hold the trigger. Mean it.'],
  ],
  freed: W => pick(W, [
    ['ian', '...Took you long enough.'],
    ['jesse', 'I had a scheduling conflict.'],
    ['ian', 'With the MISSION.'],
    ['jesse', 'My AI is very sorry. ...It says it isn\'t.'],
  ], [
    ['jesse', 'IAN! I knew you\'d come! My AI predicted it!'],
    ['ian', 'Your AI had the launch on Thursday.'],
    ['jesse', 'And it\'s Tuesday, and you came anyway. Checkmate.'],
    ['ian', 'That\'s not what checkmate means.'],
  ]),
  critical: [
    ['narr', 'The queen hits the floor. The whole hive shudders. Deep below, something goes critical.'],
    ['bigt', 'Why is the FLOOR making THAT noise?!', 'yell'],
    ['eli', 'We killed the queen and now the planet\'s mad about it.'],
    ['richie', 'The wall broke! There\'s a shaft! UP UP UP, DUDE!', 'yell'],
  ],
  escape: ['GET TO THE SHIP', 'The planet is coming apart. Climb the shaft on the left side of the arena. It comes out right next to the ship.'],

  ending: (W, tape) => [
    [210, 'bigt', 'TURN IT UP!!'],
    [380, 'richie', 'Dude. Whose playlist is this?'],
    [560, 'jesse', 'My AI made it. "Songs for Leaving Exploding Planets, Vol. 1."'],
    [780, 'ian', '...It\'s good. I hate that it\'s good.'],
    [960, 'eli', 'Oh great. It\'s the road-trip brothers.'],
    [1130, 'richie', 'Called shotgun on the planet, by the way. It counts.'],
    [1300, 'bigt', 'BAD BOYS FOR LIFE! ...IN SPACE!'],
    ...(tape ? [[1500, 'narr', pick(W,
      'J slides SPORTS PAGES VOL. 46 into Ian\'s bag. Ian doesn\'t notice. Yet.',
      'Ian slides SPORTS PAGES VOL. 46 under J\'s seat. J doesn\'t notice. Yet.')]] : []),
  ],
};
