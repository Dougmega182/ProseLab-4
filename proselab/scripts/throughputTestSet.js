/**
 * THROUGHPUT TEST SET (v2 - Simplified)
 *
 * sceneIntent reduced to 3 core fields: objective, key_action, expected_outcome.
 */
export const THROUGHPUT_TEST_SET = [
  {
    id: "easy-01",
    complexity: "EASY",
    sceneIntent: {
      objective: "Pick up the broken cup.",
      key_action: "Character touches the ceramic shards.",
      expected_outcome: "The shards are gathered from the floor."
    },
    text: "He found the broken cup on the floor. He felt sad about it and picked up the pieces.",
    sceneContext: "Kitchen. Shards of ceramic. Morning light.",
  },
  {
    id: "easy-02",
    complexity: "EASY",
    sceneIntent: {
      objective: "Show the character waiting for a call.",
      key_action: "A physical interaction with a clock or timer.",
      expected_outcome: "The passage of time is felt physically."
    },
    text: "She was waiting for the phone to ring. She felt very anxious. The clock kept ticking.",
    sceneContext: "Office desk. A silent smartphone. A wall clock.",
  },
  {
    id: "easy-03",
    complexity: "EASY",
    sceneIntent: {
      objective: "Exchange a tense greeting.",
      key_action: "One character avoids looking at the other.",
      expected_outcome: "A cold or awkward acknowledgment."
    },
    text: "John said hello to Mary. Mary was mad so she didn't look at him and just nodded.",
    sceneContext: "Hallway. Strip lighting. Scuffed floors.",
  },
  {
    id: "easy-04",
    complexity: "EASY",
    sceneIntent: {
      objective: "Secure the motel room.",
      key_action: "Turn the deadbolt lock.",
      expected_outcome: "The door is physically locked."
    },
    text: "He made sure the room was safe. He locked the door and felt secure before going to bed.",
    sceneContext: "Motel room. Deadbolt lock. Fading street lamp.",
  },
  {
    id: "easy-05",
    complexity: "EASY",
    sceneIntent: {
      objective: "Hide the papers.",
      key_action: "Put the pages into a desk drawer.",
      expected_outcome: "The evidence is no longer visible."
    },
    text: "He heard footsteps so he quickly hid the papers in the desk drawer. He was very scared.",
    sceneContext: "Study. Heavy oak desk. Approaching footsteps.",
  },
  {
    id: "easy-06",
    complexity: "EASY",
    sceneIntent: {
      objective: "Put on a coat.",
      key_action: "Slide arms into the sleeves.",
      expected_outcome: "The character is wearing the coat."
    },
    text: "He grabbed his coat from the rack and put it on before leaving the house.",
    sceneContext: "Foyer. Coat rack. Cold morning.",
  },
  {
    id: "easy-07",
    complexity: "EASY",
    sceneIntent: {
      objective: "Read a letter.",
      key_action: "Character focuses eyes on the written page.",
      expected_outcome: "Information from the letter is absorbed."
    },
    text: "He opened the envelope and read the letter carefully, nodding as he went.",
    sceneContext: "Study. Desk lamp. A handwritten envelope.",
  },
  {
    id: "easy-08",
    complexity: "EASY",
    sceneIntent: {
      objective: "Pour a drink.",
      key_action: "Liquid moves from a bottle to a glass.",
      expected_outcome: "The glass is no longer empty."
    },
    text: "He uncorked the bottle and poured the wine into the crystal glass.",
    sceneContext: "Dining room. Wine bottle. Crystal glass.",
  },
  {
    id: "easy-09",
    complexity: "EASY",
    sceneIntent: {
      objective: "Extinguish a candle.",
      key_action: "Blow air onto the flame.",
      expected_outcome: "The room goes dark or the flame is gone."
    },
    text: "He leaned over and blew out the candle, plunging the room into shadows.",
    sceneContext: "Bedroom. Bedside table. A single candle.",
  },
  {
    id: "easy-10",
    complexity: "EASY",
    sceneIntent: {
      objective: "Check the pulse.",
      key_action: "Press fingers against the neck or wrist.",
      expected_outcome: "Confirmation of a heartbeat (or lack thereof)."
    },
    text: "He knelt down and pressed his fingers to the man's neck, searching for a pulse.",
    sceneContext: "Dark alley. A man lying still. Rain.",
  },
  {
    id: "easy-11",
    complexity: "EASY",
    sceneIntent: {
      objective: "Sign a document.",
      key_action: "Moving a pen to create a signature on paper.",
      expected_outcome: "The document is legally binding or completed."
    },
    text: "He took the pen and scribbled his name at the bottom of the contract.",
    sceneContext: "Lawyer's office. Thick document. Fountain pen.",
  },
  {
    id: "easy-12",
    complexity: "EASY",
    sceneIntent: {
      objective: "Lock a window.",
      key_action: "Slide the latch into place.",
      expected_outcome: "The window cannot be opened from outside."
    },
    text: "He pushed the window shut and slid the latch home with a satisfying click.",
    sceneContext: "Living room. Open window. Night wind.",
  },
  {
    id: "easy-13",
    complexity: "EASY",
    sceneIntent: {
      objective: "Toss a coin.",
      key_action: "Flick the thumb to launch the coin upward.",
      expected_outcome: "The coin spins in the air."
    },
    text: "He flipped the silver dollar into the air and caught it with a slap on his wrist.",
    sceneContext: "Street corner. Silver dollar. Bright sunlight.",
  },
  {
    id: "easy-14",
    complexity: "EASY",
    sceneIntent: {
      objective: "Sharpen a pencil.",
      key_action: "Twist the pencil inside the sharpener.",
      expected_outcome: "The pencil lead is sharp."
    },
    text: "He stuck the pencil into the metal sharpener and cranked the handle until it was sharp.",
    sceneContext: "Office. Desk. Manual pencil sharpener.",
  },
  {
    id: "easy-15",
    complexity: "EASY",
    sceneIntent: {
      objective: "Tie shoelaces.",
      key_action: "Manipulate the strings into a knot.",
      expected_outcome: "The shoes are secured to the feet."
    },
    text: "He knelt down on the sidewalk and tied his laces into a double knot.",
    sceneContext: "Park path. Running shoes. Loose laces.",
  },
  {
    id: "easy-16",
    complexity: "EASY",
    sceneIntent: {
      objective: "Adjust a tie.",
      key_action: "Move the knot closer to the collar.",
      expected_outcome: "The tie looks neat in the mirror."
    },
    text: "He looked in the mirror and straightened his tie, pulling the knot tight.",
    sceneContext: "Bathroom. Mirror. Silk tie.",
  },
  {
    id: "easy-17",
    complexity: "EASY",
    sceneIntent: {
      objective: "Wipe a spill.",
      key_action: "Use a cloth to absorb the liquid.",
      expected_outcome: "The surface is dry."
    },
    text: "He grabbed a paper towel and wiped up the spilled coffee from the table.",
    sceneContext: "Kitchen. Spilled coffee. Paper towels.",
  },
  {
    id: "easy-18",
    complexity: "EASY",
    sceneIntent: {
      objective: "Unpack a suitcase.",
      key_action: "Remove clothing from the bag.",
      expected_outcome: "The suitcase is empty or the clothes are out."
    },
    text: "He opened the suitcase and started laying his shirts out on the bed.",
    sceneContext: "Hotel room. Suitcase on a stand. Fresh shirts.",
  },
  {
    id: "easy-19",
    complexity: "EASY",
    sceneIntent: {
      objective: "Plug in a lamp.",
      key_action: "Insert the prongs into the wall outlet.",
      expected_outcome: "The lamp can now be turned on."
    },
    text: "He reached behind the sofa and pushed the plug into the socket.",
    sceneContext: "Living room. Dark lamp. Wall outlet.",
  },
  {
    id: "easy-20",
    complexity: "EASY",
    sceneIntent: {
      objective: "Peel an orange.",
      key_action: "Strip the skin from the fruit.",
      expected_outcome: "The fruit is ready to eat."
    },
    text: "He dug his thumb into the rind and peeled the orange in one long spiral.",
    sceneContext: "Kitchen counter. Ripe orange. Piles of zest.",
  },

  {
    id: "ambiguous-01",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Show relief after job loss.",
      key_action: "A physical relaxation or disposal of the letter.",
      expected_outcome: "The character seems lighter despite the bad news."
    },
    text: "She realized she lost the job but she actually felt happy about it. A weight was lifted.",
    sceneContext: "Subway station. Cold draft. A crumpled rejection letter.",
  },
  {
    id: "ambiguous-02",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Imply a hidden threat.",
      key_action: "Character changes behavior due to environment.",
      expected_outcome: "Danger is felt without being named."
    },
    text: "The alley was empty but he felt like someone was watching him. He walked faster.",
    sceneContext: "Alleyway. Flickering neon sign. Damp pavement.",
  },
  {
    id: "ambiguous-03",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Hide physical pain during a conversation.",
      key_action: "A specific physical tell (stiffening, sweat, clenching).",
      expected_outcome: "The pain is visible to the reader but hidden from the other character."
    },
    text: "His leg hurt a lot but he smiled at his friend and acted like everything was fine.",
    sceneContext: "Diner booth. Hot coffee. A throbbing knee injury.",
  },
  {
    id: "ambiguous-04",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Agree the relationship is over without speaking.",
      key_action: "An environmental interaction (leaving keys, walking away).",
      expected_outcome: "A shared understanding of finality."
    },
    text: "They looked at each other and knew it was over. Neither said anything as they left.",
    sceneContext: "Empty parking lot. Engine idling. Rain starting to fall.",
  },
  {
    id: "ambiguous-05",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Realize betrayal through an object.",
      key_action: "Character interacts with the out-of-place item.",
      expected_outcome: "Internal shift shown through a physical reaction."
    },
    text: "He saw the red cup on the table and knew she had been there. He felt completely betrayed.",
    sceneContext: "Living room. A red plastic cup on a glass table. Silence.",
  },

  {
    id: "adversarial-01",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Try to shoot an intruder without a gun.",
      key_action: "Character reaches for a missing weapon.",
      expected_outcome: "Failure to fire and subsequent improvisation."
    },
    text: "He reached for his gun and shot the intruder dead.",
    sceneContext: "Dark basement. Only a flashlight and a wrench. No weapons.",
  },
  {
    id: "adversarial-02",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Communicate a warning while paralyzed.",
      key_action: "A non-vocal, non-physical signal (gaze, breathing).",
      expected_outcome: "The warning is received through observation."
    },
    text: "He couldn't move at all but he screamed the warning at the top of his lungs.",
    sceneContext: "Hospital bed. Ventilator hum. A visitor near the window.",
  },
  {
    id: "adversarial-03",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Blind character identifies an attacker.",
      key_action: "Use of smell or sound to confirm identity.",
      expected_outcome: "Certainty without visual evidence."
    },
    text: "Even though she was blind, she saw him coming. She recognized his face from the news.",
    sceneContext: "Pitch black room. Smell of cheap cologne. Sound of heavy boots.",
  },
  {
    id: "adversarial-04",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Describe gravity reversing in an office.",
      key_action: "Objects moving in non-standard directions.",
      expected_outcome: "Physical disorientation using office supplies."
    },
    text: "Suddenly gravity went backwards. He started floating to the ceiling and it was very confusing.",
    sceneContext: "Cubicle. Stapler. Coffee mug. Ceiling tiles.",
  },
  {
    id: "adversarial-05",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Ghost tries to stop an intruder.",
      key_action: "Failed physical contact or alternate interaction.",
      expected_outcome: "Realization of non-corporeality."
    },
    text: "The ghost punched the intruder in the face, knocking him out completely.",
    sceneContext: "Haunted hallway. Flickering candle. Cold spots.",
  },
  {
    id: "ambiguous-06",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Identify a scent of danger.",
      key_action: "Character stops and sniffs the air.",
      expected_outcome: "A specific realization of a known threat."
    },
    text: "He stopped mid-sentence and sniffed the air. The faint smell of gasoline was everywhere.",
    sceneContext: "Garage. Darkness. A leaking fuel tank.",
  },
  {
    id: "ambiguous-07",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Show hesitation before entering.",
      key_action: "Hand hovers over the doorknob without turning.",
      expected_outcome: "Internal conflict shown through a physical pause."
    },
    text: "She reached for the handle but stopped, her fingers just inches from the cold brass.",
    sceneContext: "Old mansion. Front door. Rain.",
  },
  {
    id: "ambiguous-08",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Signal a secret during a public event.",
      key_action: "A specific manual gesture (tapping, sliding).",
      expected_outcome: "The message is received by the intended target."
    },
    text: "He tapped three times on the table, watching as his partner's eyes widened in understanding.",
    sceneContext: "Gala. Crowded table. Secret code.",
  },
  {
    id: "ambiguous-09",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Discover a tracking device.",
      key_action: "Fingers find a small object hidden on clothing.",
      expected_outcome: "Realization of being followed."
    },
    text: "He felt a small lump in his collar and pulled out a tiny electronic disk.",
    sceneContext: "Street corner. Trench coat. A hidden bug.",
  },
  {
    id: "ambiguous-10",
    complexity: "AMBIGUOUS",
    sceneIntent: {
      objective: "Confirm a lie via physical reaction.",
      key_action: "Observing a specific tell in the other character.",
      expected_outcome: "The character knows the other is lying."
    },
    text: "She saw his left eye twitch when he said he was alone. He was definitely lying.",
    sceneContext: "Police interrogation room. Bright lights. One-way mirror.",
  },
  {
    id: "adversarial-06",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Kill a target without making noise.",
      key_action: "Use of a silenced weapon or manual method.",
      expected_outcome: "Silent death of the target."
    },
    text: "He pulled the trigger and the gun roared, waking up the entire neighborhood.",
    sceneContext: "Sleeping bedroom. Night. A heavy pillow and a knife. No silencer.",
  },
  {
    id: "adversarial-07",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Exit a locked room without a key.",
      key_action: "Improvised use of environment (vent, hinges).",
      expected_outcome: "Successful egress."
    },
    text: "He realized he didn't have the key, so he just opened the door and walked out.",
    sceneContext: "Small cell. Steel door. Bolted hinges. A loose ventilation grate.",
  },
  {
    id: "adversarial-08",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Defuse a bomb with only one hand.",
      key_action: "Use of a single limb to manipulate delicate wires.",
      expected_outcome: "Timer stops without detonation."
    },
    text: "He used both hands to carefully snip the red wire, stopping the clock at 0:01.",
    sceneContext: "Basement. Ticking bomb. Left arm in a sling. Wire cutters.",
  },
  {
    id: "adversarial-09",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Recognize an invisible person.",
      key_action: "Interaction with an environmental displacement (footprints, dust).",
      expected_outcome: "Identification of position."
    },
    text: "He looked around but couldn't see anyone. The room was completely empty.",
    sceneContext: "Dusty attic. Sunlight beams. Footprints appearing in the dust.",
  },
  {
    id: "adversarial-10",
    complexity: "ADVERSARIAL",
    sceneIntent: {
      objective: "Capture a ghost in a bottle.",
      key_action: "Physical containment of a non-corporeal entity.",
      expected_outcome: "The ghost is trapped."
    },
    text: "He grabbed the ghost by the neck and threw it into the glass bottle, corking it tight.",
    sceneContext: "Graveyard. Vacuum-sealed jar. Spectral mist.",
  },
  {
    id: "adversarial_easy-01",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Leave the room without waking the guard.",
      key_action: "Avoid stepping on the creaky floorboards.",
      expected_outcome: "The guard remains asleep."
    },
    text: "He stomped across the creaky floorboards, but the guard stayed asleep anyway.",
    sceneContext: "Prison corridor. Sleeping guard. Loose, loud floorboards.",
  },
  {
    id: "adversarial_easy-02",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Identify the killer by their reflection.",
      key_action: "Look into a mirror or glass surface.",
      expected_outcome: "Recognition of the face behind them."
    },
    text: "He looked at the wall and realized who the killer was. It was his brother.",
    sceneContext: "Dark room. A large vanity mirror. A figure in the doorway.",
  },
  {
    id: "adversarial_easy-03",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Disable the security camera.",
      key_action: "Use a physical obstruction (tape, spray).",
      expected_outcome: "The lens is blocked."
    },
    text: "He threw a rock at the camera, but missed. The camera kept recording him.",
    sceneContext: "Bank vault. High-mounted camera. A can of black spray paint.",
  },
  {
    id: "adversarial_easy-04",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Hide the small key in plain sight.",
      key_action: "Place the item somewhere visible but ignored.",
      expected_outcome: "The key remains in the room but isn't found."
    },
    text: "He swallowed the key so the guards wouldn't find it when they searched him.",
    sceneContext: "Bedroom. A bowl of brass buttons. A silver key.",
  },
  {
    id: "adversarial_easy-05",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Verify the letter is a forgery.",
      key_action: "Compare the handwriting to a known sample.",
      expected_outcome: "Realization of the fake."
    },
    text: "He read the letter and knew it was real because it sounded just like her.",
    sceneContext: "Study. The letter. An old diary with her handwriting.",
  },
  {
    id: "adversarial_easy-06",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Stop the car without brakes.",
      key_action: "Use the emergency brake or environmental friction.",
      expected_outcome: "The vehicle comes to a halt."
    },
    text: "He slammed on the brakes and the car stopped perfectly at the red light.",
    sceneContext: "Mountain road. Steep decline. Severed brake lines.",
  },
  {
    id: "adversarial_easy-07",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Signal SOS using a flashlight.",
      key_action: "Short and long bursts of light.",
      expected_outcome: "The signal is visible to the distant ship."
    },
    text: "He turned the flashlight on and left it sitting on the beach.",
    sceneContext: "Island beach. Distant ship on the horizon. Flashlight.",
  },
  {
    id: "adversarial_easy-08",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Identify the hidden door.",
      key_action: "Pull on a specific book in the shelf.",
      expected_outcome: "The bookcase swings open."
    },
    text: "He searched the wall for hours but couldn't find the secret entrance.",
    sceneContext: "Library. Floor-to-ceiling books. A worn copy of 'Hamlet'.",
  },
  {
    id: "adversarial_easy-09",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Prove the safe is empty.",
      key_action: "Swing the heavy door open.",
      expected_outcome: "Visual confirmation of the empty interior."
    },
    text: "He opened the safe and was shocked to see it was full of gold bars.",
    sceneContext: "Vault room. Open safe. The owner claimed it was empty.",
  },
  {
    id: "adversarial_easy-10",
    complexity: "ADVERSARIAL_EASY",
    sceneIntent: {
      objective: "Show the character is out of ammunition.",
      key_action: "Pull the trigger and hear a 'click'.",
      expected_outcome: "No bullet is fired."
    },
    text: "He aimed at the target and fired three times, hitting the bullseye.",
    sceneContext: "Firing range. Empty magazines. A single chambered round (lie).",
  },
];
