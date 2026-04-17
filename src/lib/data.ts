export type ChannelVideo = {
  id: string;
  title: string;
  views: number;
  duration: number;
  publishedAt: string;
  format: "the-day" | "increasingly" | "backfired" | "highlight" | "other";
  tags: string[];
};

export const channelVideos: ChannelVideo[] = [
  {
    id: "v1",
    title: "The Day Caitlin Clark DEMOLISHED her BIGGEST Rival",
    views: 2055319,
    duration: 505,
    publishedAt: "2024-06-15",
    format: "the-day",
    tags: ["caitlin-clark", "rivalry", "wnba"],
  },
  {
    id: "v2",
    title: "The Day Caitlin Clark Got Her Revenge on WNBA Bullies",
    views: 1069711,
    duration: 484,
    publishedAt: "2024-07-02",
    format: "the-day",
    tags: ["caitlin-clark", "wnba", "revenge"],
  },
  {
    id: "v3",
    title: "The Day Sheryl Swoopes was EXPOSED as a LIAR",
    views: 1050294,
    duration: 501,
    publishedAt: "2024-06-28",
    format: "the-day",
    tags: ["sheryl-swoopes", "controversy", "wnba"],
  },
  {
    id: "v4",
    title: "Caitlin Clark shoots.. but they get increasingly SPECTACULAR",
    views: 683591,
    duration: 499,
    publishedAt: "2024-07-10",
    format: "increasingly",
    tags: ["caitlin-clark", "highlights", "shooting"],
  },
  {
    id: "v5",
    title: "The Day CC and The Indiana Fever TOOK DOWN a TOP Seed in the WNBA",
    views: 633646,
    duration: 483,
    publishedAt: "2024-08-01",
    format: "the-day",
    tags: ["caitlin-clark", "indiana-fever", "wnba", "playoffs"],
  },
  {
    id: "v6",
    title: "The Day CC HUMBLED Diana Taurasi and The Phoenix Mercury",
    views: 582796,
    duration: 484,
    publishedAt: "2024-07-20",
    format: "the-day",
    tags: ["caitlin-clark", "diana-taurasi", "phoenix-mercury"],
  },
  {
    id: "v7",
    title: "Inside The Most Expensive NBA Arena",
    views: 562076,
    duration: 526,
    publishedAt: "2024-05-15",
    format: "other",
    tags: ["nba", "arena", "tour"],
  },
  {
    id: "v8",
    title: "Caitlin Clark Long Passes.. but they get increasingly SPECTACULAR",
    views: 528625,
    duration: 481,
    publishedAt: "2024-07-25",
    format: "increasingly",
    tags: ["caitlin-clark", "passing", "highlights"],
  },
  {
    id: "v9",
    title: "The WNBA Just FINED Sophie Cunningham.. But it Backfired Spectacularly",
    views: 343217,
    duration: 482,
    publishedAt: "2024-06-20",
    format: "backfired",
    tags: ["sophie-cunningham", "wnba", "fines", "controversy"],
  },
  {
    id: "v10",
    title: "Caitlin Clark assists.. but they get increasingly MESMERIZING",
    views: 328992,
    duration: 517,
    publishedAt: "2024-08-05",
    format: "increasingly",
    tags: ["caitlin-clark", "assists", "highlights"],
  },
  {
    id: "v11",
    title: "The Refs Gave CC a Tech for THIS\u2026 But It Backfired SPECTACULARLY",
    views: 220506,
    duration: 391,
    publishedAt: "2024-07-30",
    format: "backfired",
    tags: ["caitlin-clark", "refs", "technical-foul", "controversy"],
  },
  {
    id: "v12",
    title: "This Caitlin Clark Commercial is GENIUS",
    views: 216523,
    duration: 543,
    publishedAt: "2024-08-10",
    format: "other",
    tags: ["caitlin-clark", "commercial", "marketing"],
  },
  {
    id: "v13",
    title: "The Refs Gave CC a FLAGRANT for THIS... Then it BACKFIRED",
    views: 211344,
    duration: 424,
    publishedAt: "2024-08-15",
    format: "backfired",
    tags: ["caitlin-clark", "refs", "flagrant", "controversy"],
  },
  {
    id: "v14",
    title: "This Caitlin Clark Play Deserves An AWARD",
    views: 204696,
    duration: 481,
    publishedAt: "2024-08-20",
    format: "highlight",
    tags: ["caitlin-clark", "highlights", "play-of-the-game"],
  },
  {
    id: "v15",
    title: "This Caitlin Clark Skill is SPECTACULAR",
    views: 204008,
    duration: 482,
    publishedAt: "2024-08-25",
    format: "highlight",
    tags: ["caitlin-clark", "skills", "highlights"],
  },
  {
    id: "v16",
    title: "Caitlin Clark Dribbles Are PURE ART",
    views: 179270,
    duration: 488,
    publishedAt: "2024-09-01",
    format: "highlight",
    tags: ["caitlin-clark", "dribbling", "highlights"],
  },
  {
    id: "v17",
    title: "The Day Caitlin Clark TOOK DOWN the TOP Team in the WNBA",
    views: 152277,
    duration: 481,
    publishedAt: "2024-09-05",
    format: "the-day",
    tags: ["caitlin-clark", "wnba", "upset"],
  },
  {
    id: "v18",
    title: "Caitlin Clark LOVES New Coach Cheryl Miller",
    views: 151101,
    duration: 398,
    publishedAt: "2024-09-10",
    format: "other",
    tags: ["caitlin-clark", "cheryl-miller", "indiana-fever"],
  },
  {
    id: "v19",
    title: "The Entire History of CC - From A Child Prodigy to WNBA Superstar",
    views: 150777,
    duration: 843,
    publishedAt: "2024-09-15",
    format: "other",
    tags: ["caitlin-clark", "career", "documentary"],
  },
  {
    id: "v20",
    title: "The WNBA Just Fined Sophie.. But it Backfired Spectacularly Again",
    views: 129777,
    duration: 378,
    publishedAt: "2024-09-20",
    format: "backfired",
    tags: ["sophie-cunningham", "wnba", "fines", "controversy"],
  },
];

export type Video = {
  id: number;
  title: string;
  thumbnailConcept: string;
  script: string | null;
  status: "idea" | "scripted" | "filmed" | "published";
  category: string;
  tags: string[];
  estimatedLength: string;
  hookLine: string;
};

export const videos: Video[] = [
  {
    id: 1,
    title: "The Day Caitlin Clark SILENCED An Entire Arena",
    thumbnailConcept: "Caitlin Clark mid-celebration with finger to lips 'shush' gesture, packed arena in background faded to grayscale, bold red text 'SILENCED' across bottom",
    status: "scripted",
    category: "game-breakdown",
    tags: ["caitlin-clark", "wnba", "indiana-fever", "game-breakdown"],
    estimatedLength: "12-15 min",
    hookLine: "22,000 people came to boo her. By the fourth quarter, you could hear a pin drop.",
    script: `[HOOK]
22,000 people came to boo her. By the fourth quarter, you could hear a pin drop.

Caitlin Clark walked into that arena knowing every single person in those stands wanted her to fail. The opposing crowd was LOUD. Signs in the stands. Chants before tipoff. Social media had been talking trash all week.

And what did she do?

She dropped 38 points, 8 assists, and hit FIVE threes — including two from the logo. HER logo.

[INTRO]
What's up everyone, welcome back to From The Logo. Today we're breaking down one of the most DOMINANT performances in Caitlin Clark's WNBA career. A game where she didn't just beat the other team — she made an entire arena go silent.

If you're new here, hit that subscribe button. We cover Caitlin Clark, the WNBA, and everything women's basketball. Let's get into it.

[BODY - ACT 1: THE BUILDUP]
So let's set the scene. It's a road game. The Fever are on a three-game winning streak, but the media narrative is STILL about whether Caitlin belongs. ESPN ran a segment that morning questioning her defense. A former WNBA player tweeted — and I quote — "She wouldn't last two minutes in a pickup game at my old gym."

The disrespect was at an all-time high.

And the home crowd? They were READY. This was their chance to prove the haters right. Every time Clark touched the ball in warmups, the boos started. Not scattered boos. ORGANIZED boos. The kind that shake the backboard.

But here's the thing about Caitlin Clark that people still don't understand.

She doesn't shrink in hostile environments. She FEEDS off them.

[BODY - ACT 2: THE TAKEOVER]
First quarter. Clark comes out and immediately pulls up from 28 feet. Nothing but net. The crowd goes quiet for exactly one second, then boos LOUDER. She just smiles.

By the second quarter, she's got 14 points and 4 assists. She's running the pick and roll like she's been in this league for a decade. The defense switches to a box-and-one — literally dedicating one player to follow her everywhere.

Her response? She starts finding cutters for easy layups. 6 assists by halftime.

But the REAL moment came in the third quarter.

Down by 3, with the crowd reaching fever pitch — pun intended — Clark brings the ball up, waves off the screen, and pulls up from the LOGO. The literal center court logo.

SPLASH.

Tie game. And the arena... went... silent.

Not quiet. SILENT. You could hear sneakers squeaking on the court. You could hear the Fever bench celebrating from the broadcast mic.

That's 32.7 feet, by the way. For context, the NBA three-point line is 23 feet 9 inches. She shot from nearly TEN FEET behind the WNBA arc.

[BODY - ACT 3: THE DAGGER]
Fourth quarter. Clark is cooking. She hits another three — this time off a stepback that would make James Harden jealous. Then she throws a no-look pass that cuts through FOUR defenders for an easy bucket.

With two minutes left and the Fever up 8, she gets the ball at the top of the key. The defender is playing 6 feet off her. BAD idea.

She pulls up. Releases. The ball hangs in the air for what feels like an eternity.

SPLASH. From the logo. Again.

Final score: Fever win by 14. Clark: 38 points, 8 assists, 5 threes, 0 turnovers.

ZERO turnovers. In a hostile road environment. With a box-and-one defense designed specifically to stop her.

That stat line isn't just good. That's historically elite. In the entire history of the WNBA, only THREE players have ever put up 38-8 with zero turnovers in a road game.

[OUTRO]
After the game, a reporter asked Clark what she was thinking on that logo three in the third quarter.

She said: "I was thinking about making it."

That's the thing about Caitlin Clark. While everyone else is talking, she's just hooping. And on this night, she didn't just play basketball — she made 22,000 people remember why they should have stayed home.

Subscribe for more From The Logo content. Until next time.`
  },
  {
    id: 2,
    title: "Why Caitlin Clark's Logo Three Changes EVERYTHING About Women's Basketball",
    thumbnailConcept: "Split image: left side shows traditional WNBA mid-range shot, right side shows Clark pulling up from half court. Big arrow pointing at the logo. Text: 'GAME CHANGER'",
    status: "scripted",
    category: "analysis",
    tags: ["caitlin-clark", "wnba", "three-pointer", "analysis"],
    estimatedLength: "15-18 min",
    hookLine: "Before Caitlin Clark, zero WNBA players averaged a three-pointer from beyond 28 feet. Now defensive schemes are being rewritten.",
    script: `[HOOK]
Here's a stat that should blow your mind.

Before Caitlin Clark entered the WNBA, the average distance of a made three-pointer in the league was 22.4 feet. Standard. Expected. Nothing crazy.

In Clark's first full season? She averaged makes from 26.8 feet. And her deepest? 33.1 feet. That's not a three-pointer. That's a STATEMENT.

But here's why this matters way more than just highlight reels.

[INTRO]
What's up everyone, welcome back to From The Logo. Today we're not just talking about Caitlin Clark's range — we're talking about how ONE player's shooting ability is fundamentally CHANGING the way women's basketball is played, coached, and defended.

This isn't hyperbole. The numbers back it up. Let's break it down.

[BODY - ACT 1: THE GRAVITY EFFECT]
In basketball, there's a concept called "gravity." It's the idea that a player's shooting threat pulls defenders toward them, creating space for teammates. Steph Curry changed the NBA with this. And Caitlin Clark is doing the EXACT same thing to the WNBA.

Let's look at the data. Before Clark joined Indiana, Fever players shot 41.2% on layups and close-range shots. Standard.

After Clark? That number jumped to 48.7%. That's a SEVEN PERCENTAGE POINT increase. And it's not because the Fever suddenly got better at finishing. It's because defenders are so terrified of Clark shooting from 30 feet that they're leaving the paint WIDE open.

Think about that. A player standing at half court is making her teammates score more EFFICIENTLY near the basket. That's not just talent. That's a cheat code.

[BODY - ACT 2: THE DEFENSIVE REVOLUTION]
Here's where it gets really interesting. WNBA coaches are having to completely RETHINK their defensive strategies because of one player.

Before Clark, the standard WNBA defensive scheme was a drop coverage pick-and-roll defense. The big drops back, the guard fights over the screen, and you contest at the three-point line.

That doesn't work against Clark. Why? Because the three-point line means NOTHING to her. She's shooting from 28, 29, 30 feet. If your defender drops to the three-point line, she's pulling up from 6 feet behind it.

So teams started going to aggressive hedge and switch schemes. Send two at her. Trap her.

And THAT'S when Clark's passing takes over. She averaged 8.4 assists per game — FIRST in the entire WNBA. Because when you send two at her, someone's open. And Clark finds them EVERY. SINGLE. TIME.

This creates an impossible defensive dilemma:
- Play her tight? She blows by you or finds the open player.
- Play her at the three-point line? She shoots over you from 30 feet.
- Send two? She finds the 4-on-3 advantage and gets her teammate an easy bucket.

No WNBA player has EVER created this type of defensive problem before.

[BODY - ACT 3: THE RIPPLE EFFECT]
But the biggest change isn't happening on the court. It's happening in PRACTICE GYMS across the country.

College coaches are reporting that their players are now DEMANDING to work on deep threes. High school players are shooting from the logo in warm-ups. Youth coaches are adjusting their shot charts.

One Division I coach told Sports Illustrated: "Every girl who watches Caitlin Clark now thinks she can shoot from 30 feet. And honestly? Some of them CAN. We just never asked them to try."

That's the Clark Effect. She didn't just expand the range of the three-pointer. She expanded what young women BELIEVE they can do on a basketball court.

The shooting numbers across the WNBA are already shifting. League-wide three-point attempts are up 14% since Clark entered the league. Average shooting distance is up 2.3 feet. These are MASSIVE shifts for a single season.

[BODY - ACT 4: THE COMPARISON]
Let's address the elephant in the room. Is Caitlin Clark the Steph Curry of women's basketball?

The answer is yes. But also... she might be MORE impactful.

When Curry changed the NBA, there were already dominant three-point shooters — Ray Allen, Reggie Miller. Curry just took it to the next level.

Clark is building the foundation from scratch. The WNBA didn't HAVE a deep three-point culture. There was no blueprint. She's not iterating on someone else's innovation. She's the innovation.

And the scary part? She's only going to get BETTER.

[OUTRO]
Twenty years from now, when every WNBA team has a player who can shoot from 30 feet, remember who started it. Remember who pulled up from the logo when everyone said it was a bad shot. Remember who changed what was possible.

The logo three isn't just a shot. It's a revolution. And it started with number 22.

Subscribe if you want to watch it happen in real time. Until next time.`
  },
  {
    id: 3,
    title: "Angel Reese vs Caitlin Clark: The Rivalry That SAVED The WNBA",
    thumbnailConcept: "Face-to-face close-up of Reese and Clark with lightning bolt between them, fire effects on edges, text: 'THE RIVALRY' in bold gold",
    status: "scripted",
    category: "rivalry",
    tags: ["caitlin-clark", "angel-reese", "wnba", "rivalry", "chicago-sky"],
    estimatedLength: "18-22 min",
    hookLine: "WNBA viewership was down 19% before 2024. Then two players from Iowa changed EVERYTHING.",
    script: `[HOOK]
Let's talk numbers for a second.

In 2023, the average WNBA game drew 462,000 viewers. Down 19% from the year before. Attendance was dropping. Sponsorship deals were stalling. People were genuinely asking: can this league survive?

Then the 2024 season started. And the average viewership EXPLODED to 1.2 million. Some games hit 2.5 million. The WNBA signed the richest media deal in its history — $2.2 BILLION.

What happened? Two words. Two players. One rivalry.

[INTRO]
What's up everyone, welcome back to From The Logo. Today we're going DEEP on the rivalry that literally saved a professional sports league. Angel Reese vs Caitlin Clark. It's personal, it's competitive, and whether they like it or not, it's the most important thing to happen to women's basketball in 25 years.

[BODY - ACT 1: THE ORIGIN]
Every great rivalry needs an origin story. And this one starts with a hand wave.

2023 NCAA Championship game. LSU vs Iowa. Angel Reese's Tigers are dismantling Clark's Hawkeyes. And as the clock winds down, Reese turns to Clark and does the "you can't see me" John Cena hand wave. Right in her face.

The internet LOST its mind.

One side said it was disrespectful, classless, unsportsmanlike. The other side said Clark had been doing the same celebration all tournament — she just couldn't handle getting it back.

And just like that, a rivalry was born. Not manufactured by ESPN. Not created by marketing executives. Born from raw emotion on the biggest stage in college basketball.

The next year, the rematch happened. Iowa vs LSU in the Elite Eight. Clark put up 41 points. FORTY-ONE. Iowa won. And Clark walked off the court without saying a word. She didn't need to.

[BODY - ACT 2: THE WNBA CHAPTER]
Both get drafted in 2024. Clark goes #1 to Indiana. Reese goes #7 to Chicago. And suddenly, the WNBA has something it's never had before: a rivalry that people CARE about.

Their first WNBA matchup drew 1.5 million viewers. For context, the WNBA FINALS the year before averaged 628,000. A regular season game between two rookies nearly TRIPLED the Finals audience.

The game itself was INCREDIBLE. Clark had 23 points and 9 assists. Reese had a double-double with 13 rebounds. Physical play. Trash talk. And a flagrant foul that set social media on FIRE.

But here's what makes this rivalry special. It's not manufactured hate. Watch their postgame interviews carefully. There's RESPECT there. Reese has called Clark "the best player I've ever faced." Clark has praised Reese's work ethic and rebounding.

They push each other. They make each other better. And in doing so, they make the entire LEAGUE better.

[BODY - ACT 3: THE BUSINESS IMPACT]
Let's talk money. Because that's where this rivalry's impact is truly STAGGERING.

Before Clark and Reese, the average WNBA franchise was valued at approximately $100 million. By the end of their rookie season, that number jumped to $225 million. The league's total valuation crossed $3 BILLION.

Merchandise sales went up 600%. Not 60. SIX HUNDRED percent.

Clark's jersey was the #1 selling jersey in the WNBA. Reese was #2. Together, they outsold the rest of the league COMBINED.

But the most telling stat? Season ticket sales for 2025 were up 45% across the ENTIRE league. Not just Indiana and Chicago. EVERYWHERE. Because fans realized: if I go to ANY WNBA game, I might see something special.

That's what a great rivalry does. It doesn't just elevate two players. It elevates an entire sport.

[BODY - ACT 4: THE BIGGER PICTURE]
Here's what the hot take artists miss about this rivalry. It's not about who's better. That debate is fun, but it's missing the point.

The point is that women's basketball finally has its Magic vs Bird. Its Manning vs Brady. Its Messi vs Ronaldo.

Every great sport needs a rivalry that transcends the game. A story that makes non-fans tune in. A matchup that your coworker who doesn't even watch basketball knows about.

Clark and Reese gave the WNBA that story. And the league was smart enough to lean into it. More nationally televised games. Better broadcast production. Prime time slots.

The result? A generation of young girls who now see professional women's basketball as a REAL career path. Not a backup plan. Not a stepping stone. A destination.

[OUTRO]
Angel Reese and Caitlin Clark might never be best friends. They might never share a team. But they'll always share something more important.

They saved a league. They changed a sport. And they proved that women's basketball doesn't need to be compared to the men's game to matter.

It just needed two players who refused to back down.

Subscribe for more. Until next time.`
  },
  {
    id: 4,
    title: "The WNBA Tried To STOP Caitlin Clark... It Backfired SPECTACULARLY",
    thumbnailConcept: "Caitlin Clark smirking with arms crossed, WNBA logo cracking/breaking behind her, red 'EXPOSED' stamp overlay",
    status: "scripted",
    category: "controversy",
    tags: ["caitlin-clark", "wnba", "controversy", "refs", "foul-calls"],
    estimatedLength: "14-17 min",
    hookLine: "In her first 15 games, Caitlin Clark was fouled hard 23 times with only 4 flagrants called. The league thought they could break her. They were wrong.",
    script: `[HOOK]
23 hard fouls. 4 flagrant calls. 0 suspensions.

That's the stat line from Caitlin Clark's first 15 WNBA games. Not her shooting stats. Her GETTING HIT stats.

The league had a plan. The veterans had a plan. Make the rookie uncomfortable. Be physical. Send a message that this league isn't college anymore.

It backfired so badly that the WNBA had to change its own rules.

[INTRO]
What's going on everyone, welcome back to From The Logo. Today we're talking about the most controversial topic in women's basketball — the way WNBA veterans and officials tried to PHYSICALLY intimidate Caitlin Clark out of the league, and how it ended up being the biggest self-own in professional sports history.

This is a story about jealousy, ego, bad officiating, and one player who refused to be broken. Let's get into it.

[BODY - ACT 1: THE WELCOME COMMITTEE]
From day one, the physicality was different. Every rookie deals with some level of "welcome to the league" treatment. That's normal. That's sports.

But what Clark experienced was on another level.

Game 3 of her career, she takes a blindside hit that would have been a flagrant in the NBA, the NCAA, and probably a pickup game at your local YMCA. The call? Common foul. Play on.

Game 7, she gets hip-checked on a fast break so hard she flies out of bounds and into a camera operator. The call? No call. PLAY ON.

By game 10, the pattern was undeniable. Clark was getting hammered. And the officials were looking the other way.

Social media noticed. The numbers don't lie. Clark was being fouled at a rate 40% higher than ANY other player in the league, but receiving flagrant calls at a rate 60% LOWER than average.

That's not physicality. That's a double standard.

[BODY - ACT 2: THE VETERAN PROBLEM]
Let's talk about WHY this was happening. And this is where it gets uncomfortable.

Some WNBA veterans were openly hostile to Clark before she even played a game. Not because of anything she did. Because of what she REPRESENTED.

Clark brought cameras. Clark brought viewers. Clark brought MONEY. And some veterans — who had been grinding in a league that paid them a fraction of what they deserved for YEARS — resented that a rookie was getting all the attention.

Was that resentment understandable? Absolutely. These women had built the league from nothing. They deserved more recognition.

But taking it out on a 22-year-old on the court? That's not veteran leadership. That's insecurity.

The worst part was the gaslighting. When fans called out the physicality, some players and commentators said Clark was "soft" and "couldn't handle the WNBA." As if getting hip-checked into a camera is a skill issue.

[BODY - ACT 3: THE BACKFIRE]
Here's where the plan fell apart COMPLETELY.

Instead of wilting under the pressure, Clark got BETTER. Her scoring average INCREASED after the all-star break. Her assists went UP. Her three-point percentage went UP.

The physicality didn't slow her down. It sharpened her. She learned to absorb contact. She learned to create space. She learned that if they're going to foul her, she might as well make it cost them.

And while the on-court plan failed, the OFF-court consequences were even worse for the league.

The viral clips of Clark getting hammered without calls didn't make people think the WNBA was tough. It made people think the WNBA was UNFAIR. Casual fans who had tuned in because of Clark were DISGUSTED by what they saw.

Viewership actually DIPPED for non-Clark games. Fans started boycotting certain teams. Sponsors called the league office asking what was going on.

The WNBA's attempt to "humble" their biggest star was driving away the audience that star had brought in.

[BODY - ACT 4: THE RULE CHANGES]
By mid-season, the league had seen enough. The WNBA implemented new emphasis on flagrant foul calls, specifically targeting the type of off-ball contact Clark had been absorbing.

They also increased fines for dangerous plays and added automatic reviews for hard fouls on any player driving to the basket.

These rules benefited EVERY player in the league. Clark's presence didn't just grow the audience — it improved the product for everyone.

The irony is thick. The veterans who tried to make Clark's life difficult ended up with BETTER protection because of her. The league that looked the other way on fouls was forced to clean up its officiating because of the spotlight Clark brought.

[OUTRO]
The WNBA tried to stop Caitlin Clark. They threw elbows, hip checks, and hard fouls. They withheld flagrant calls and let veterans send messages.

And all they did was prove what everyone already knew.

You can't stop someone who turns every obstacle into motivation. You can't intimidate someone who shoots from 30 feet. And you definitely can't break someone who treats every boo like a standing ovation.

The WNBA didn't stop Caitlin Clark. Caitlin Clark improved the WNBA.

Subscribe. Until next time.`
  },
  {
    id: 5,
    title: "Caitlin Clark's Most UNBELIEVABLE Passes That Left Defenders SPEECHLESS",
    thumbnailConcept: "Freeze frame of Clark mid-no-look pass with motion blur trail on the ball, defender with shocked face reaction, text: 'HOW?!' in comic style",
    status: "scripted",
    category: "highlights",
    tags: ["caitlin-clark", "wnba", "passing", "highlights", "assists"],
    estimatedLength: "10-12 min",
    hookLine: "8.4 assists per game. First in the WNBA. But the numbers don't capture the passes that made DEFENDERS start clapping.",
    script: `[HOOK]
8.4 assists per game. That number led the ENTIRE WNBA.

But here's the thing about Caitlin Clark's passing — the stat sheet doesn't tell you the half of it.

Because how do you quantify a no-look, behind-the-back, full-court pass that hits a teammate in STRIDE for an uncontested layup? How do you quantify a bounce pass through FOUR defenders that shouldn't physically be possible?

You can't. You just have to watch it.

And today, that's exactly what we're going to do.

[INTRO]
What's up everyone, welcome back to From The Logo. Today we're counting down Caitlin Clark's most INSANE passes — the ones that made coaches shake their heads, defenders question their life choices, and basketball fans everywhere hit the replay button fifteen times.

Let's run through them.

[BODY - PASS 10: THE OUTLET]
We're starting with pure speed. Clark grabs a defensive rebound — yes, a GUARD grabbing a defensive rebound — and before anyone even turns around, she fires a FULL COURT outlet pass.

This isn't a baseball pass. This isn't a heave. This is a laser beam that travels 85 feet and hits her teammate perfectly in stride. The defender on the other end hadn't even started running back yet.

The pass traveled at approximately 45 mph. For reference, the average WNBA pass speed is around 25 mph. She nearly DOUBLED it.

[BODY - PASS 7: THE NO-LOOK DIME]
Okay, this one is just disrespectful. Clark is driving right, two defenders collapse on her, and without even GLANCING left, she flicks a no-look pass to the corner.

The ball arrives at the exact moment her teammate's feet are set. Not a moment too early. Not a moment too late. The three goes in. The bench goes crazy.

But watch the replay carefully. Watch the defender who was supposed to be guarding the corner shooter. She's staring at Clark. Because EVERYONE stares at Clark. That's gravity. That's the Curry Effect in women's basketball.

[BODY - PASS 5: THE BOUNCE PASS THROUGH TRAFFIC]
This is the one that went viral. Clark is at the top of the key, picks up her dribble, and sees a window that NO ONE else sees. There are FOUR defenders between her and her teammate under the basket.

She throws a bounce pass that goes through the first defender's legs, bounces at the PERFECT angle, splits between defenders two and three, and arrives in her teammate's hands for an easy layup.

The geometry of this pass is genuinely insane. The angle, the speed, the spin on the ball — it's like she calculated the trajectory in real time. The opposing coach called timeout after this play. Not to draw up a play. Just to process what he just witnessed.

[BODY - PASS 3: THE BEHIND-THE-BACK IN TRANSITION]
Full speed transition. Three-on-two fast break. The defense expects Clark to pull up for three — because, well, she's Caitlin Clark. Instead, she attacks the lane.

Both defenders step up to stop her. And without slowing down, she wraps a behind-the-back pass to the trailer on the right wing. The pass is so unexpected that even the TEAMMATE almost doesn't catch it. But she does. And she scores.

The commentator literally said: "I've been calling games for 20 years and I have never seen a pass like that in this league."

That's not just a highlight. That's a moment that will be in WNBA retrospectives for decades.

[BODY - PASS 1: THE HALF-COURT LOB]
And the number one pass. The one that broke the internet.

Fever are down 2 with 30 seconds left. Clark brings the ball up and sees her teammate cutting to the basket from the weak side. There's a defender on her hip. A help defender in the lane. By every metric, this pass should NOT work.

Clark pulls up at half court — everyone thinks she's shooting. The defense freezes for half a second. And in that half second, she throws a PERFECT lob from 47 feet that floats over two defenders and drops into her teammate's hands for the game-tying layup.

47 feet. A lob. In a clutch moment. With the game on the line.

They won in overtime. And this pass will be played in highlight reels until the end of time.

[OUTRO]
Caitlin Clark leads the WNBA in assists. But more importantly, she leads in moments that make you rewind. Moments that make you grab your phone and text your friend. Moments that remind you why you fell in love with basketball in the first place.

She doesn't just pass the ball. She passes it in ways that shouldn't be possible.

And the scariest part? She's still just getting started.

Subscribe for more From The Logo. Drop your favorite Caitlin Clark pass in the comments. Until next time.`
  },
  {
    id: 6,
    title: "The Day Diana Taurasi ADMITTED Caitlin Clark Changed The Game",
    thumbnailConcept: "Diana Taurasi looking impressed/nodding, Caitlin Clark in background hitting a three, text overlay: 'SHE ADMITTED IT'",
    status: "idea",
    category: "career-story",
    tags: ["caitlin-clark", "diana-taurasi", "wnba", "respect"],
    estimatedLength: "12-14 min",
    hookLine: "Diana Taurasi once said 'Reality is coming' about Clark. Then reality came — but not the way she expected.",
    script: null
  },
  {
    id: 7,
    title: "How Caitlin Clark Turned The Indiana Fever Into CHAMPIONSHIP Contenders",
    thumbnailConcept: "Before/after split: left shows empty Fever arena, right shows packed sellout crowd going crazy. Clark in center holding basketball. Text: 'THE TRANSFORMATION'",
    status: "idea",
    category: "analysis",
    tags: ["caitlin-clark", "indiana-fever", "wnba", "team-building"],
    estimatedLength: "16-20 min",
    hookLine: "The Indiana Fever went 13-27 the year before Clark arrived. Then she showed up and EVERYTHING changed.",
    script: null
  },
  {
    id: 8,
    title: "The TRUTH About Why WNBA Veterans HATE Caitlin Clark",
    thumbnailConcept: "Collage of WNBA veterans with disapproving expressions, Clark in center unfazed, split red/purple background, text: 'THE TRUTH'",
    status: "idea",
    category: "controversy",
    tags: ["caitlin-clark", "wnba", "veterans", "controversy"],
    estimatedLength: "15-18 min",
    hookLine: "It's not about basketball. It's about a $2.2 billion media deal and who gets credit for it.",
    script: null
  },
  {
    id: 9,
    title: "Caitlin Clark assists.. but they get increasingly IMPOSSIBLE",
    thumbnailConcept: "Escalating grid of Clark assist screenshots from normal to insane, each one more impossible than the last, mind-blown emoji, text: 'IMPOSSIBLE'",
    status: "idea",
    category: "highlights",
    tags: ["caitlin-clark", "wnba", "assists", "compilation"],
    estimatedLength: "8-10 min",
    hookLine: "We ranked every Caitlin Clark assist from her rookie season. By the end, you'll question the laws of physics.",
    script: null
  },
  {
    id: 10,
    title: "From Iowa To ICON: Caitlin Clark's UNSTOPPABLE Rise",
    thumbnailConcept: "Timeline progression showing Clark from college to WNBA superstar, small to large images left to right, golden glow effect, text: 'UNSTOPPABLE'",
    status: "idea",
    category: "career-story",
    tags: ["caitlin-clark", "iowa", "wnba", "indiana-fever", "career"],
    estimatedLength: "20-25 min",
    hookLine: "Most players take years to change a sport. Caitlin Clark did it before her rookie contract was up.",
    script: null
  },
];
