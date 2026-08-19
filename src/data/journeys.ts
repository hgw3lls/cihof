export type JourneyItem = {
  inducteeId: string;
  label: string;
  transition: string;
};

export type JourneyKind = 'curated' | 'region';

export type Journey = {
  id: string;
  title: string;
  intro: string;
  accent: string;
  kind?: JourneyKind;
  region?: string;
  startState: string;
  endState: string;
  organizations?: string[];
  places?: string[];
  items: JourneyItem[];
};

export const journeys: Journey[] = [
  {
    id: 'who-built-cleveland',
    title: 'WHO BUILT CLEVELAND?',
    intro: 'A civic journey through people who shaped institutions, public office, neighborhoods, and the working idea of Cleveland as a city shared by many communities.',
    accent: '#c2a15a',
    kind: 'curated',
    startState: 'Start with the public dream: a city that makes room for immigrant memory in civic life.',
    endState: 'End with a mayoral story about governing a city of many neighborhoods as one community.',
    organizations: ['City of Cleveland', 'Cleveland City Council', 'Cleveland International Hall of Fame'],
    places: ['Cleveland City Hall', 'Cleveland Cultural Gardens', 'Central and Kinsman'],
    items: [
      {
        inducteeId: 'leo-weidenthal-2010',
        label: 'Civic memory and the Cultural Gardens',
        transition: 'Begin with the idea that public space can make immigrant communities visible.',
      },
      {
        inducteeId: 'senator-george-voinovich-2010',
        label: 'Public leadership from Cleveland to the nation',
        transition: 'From civic memory, move to public office and the institutions that carry city decisions outward.',
      },
      {
        inducteeId: 'ralph-j-perk-2011',
        label: 'City leadership and ethnic community visibility',
        transition: 'Perk keeps the question inside City Hall, where ethnic identity and municipal leadership met.',
      },
      {
        inducteeId: 'hon-mary-rose-oakar-2012',
        label: 'Representation across city and nation',
        transition: 'Oakar widens the path from local politics to national representation rooted in Cleveland.',
      },
      {
        inducteeId: 'valarie-mccall-2020',
        label: 'Civic strategy and public affairs',
        transition: 'McCall shows how governing also depends on people who organize relationships behind the scenes.',
      },
      {
        inducteeId: 'michael-d-polensek-2023',
        label: 'Neighborhood-centered public service',
        transition: 'Polensek brings the journey back to ward-level service and long memory in neighborhoods.',
      },
      {
        inducteeId: 'mayor-frank-jackson-2025',
        label: 'Long-serving city leadership',
        transition: 'Jackson closes the journey by connecting neighborhood origins to the responsibility of leading the whole city.',
      },
    ],
  },
  {
    id: 'who-helped-people-arrive',
    title: 'WHO HELPED PEOPLE ARRIVE?',
    intro: 'A path through legal help, settlement work, education, worker advocacy, and community bridges that helped newcomers make a life in Northeast Ohio.',
    accent: '#8f5f32',
    kind: 'curated',
    startState: 'Start at the threshold: arrival is legal, emotional, practical, and deeply human.',
    endState: 'End with newer community leadership that turns arrival into belonging.',
    organizations: ['Margaret W. Wong and Associates', 'El Barrio', 'Esperanza', 'Vietnamese community organizations'],
    places: ['AsiaTown', 'Sai Gon Plaza', 'Lorain International Festival'],
    items: [
      {
        inducteeId: 'margaret-w-wong-2010',
        label: 'Immigration law and community advocacy',
        transition: 'Begin where many arrival stories begin: with legal status, paperwork, and the fight to stay.',
      },
      {
        inducteeId: 'joseph-p-meissner-2014',
        label: 'Legal service and refugee support',
        transition: 'Meissner follows Wong by showing arrival as a justice issue, not only a legal transaction.',
      },
      {
        inducteeId: 'sister-alicia-alvarado-2018',
        label: 'Education, care, and settlement support',
        transition: 'After legal help, newcomers need trusted institutions that help families settle.',
      },
      {
        inducteeId: 'victor-ruiz-2022',
        label: 'Education, equity, and Latino leadership',
        transition: 'Ruiz extends the path into schools and youth opportunity, where belonging is built over time.',
      },
      {
        inducteeId: 'veronica-dahlberg-2024',
        label: 'Worker justice and immigrant rights',
        transition: 'Dahlberg shows that arrival also means protection at work and a public voice.',
      },
      {
        inducteeId: 'giahoa-ryan-2011',
        label: 'Vietnamese community organizing and festival life',
        transition: 'Ryan connects practical settlement to the community celebrations that make a place feel like home.',
      },
      {
        inducteeId: 'le-nguyen-2026',
        label: 'Vietnamese community bridge-building',
        transition: 'Nguyen closes with the next generation of bridge-building after arrival becomes community leadership.',
      },
    ],
  },
  {
    id: 'who-kept-cultures-alive',
    title: 'WHO KEPT CULTURES ALIVE?',
    intro: 'A portrait path about music, language, festivals, gardens, film, memory, and the people who turned heritage into public Cleveland culture.',
    accent: '#6f7d45',
    kind: 'curated',
    startState: 'Start with voice and song, the forms of culture that travel even when people move.',
    endState: 'End with cultural preservation as a public inheritance for future visitors.',
    organizations: ['Cleveland Cultural Gardens Federation', 'Russian Cultural Garden', 'Croatian Cultural Garden', 'Ukrainian Museum-Archives'],
    places: ['Cleveland Cultural Gardens', 'Rockefeller Park', 'Olde Towne Hall Theatre'],
    items: [
      {
        inducteeId: 'tony-petkovsek-2011',
        label: 'Broadcasting and Slovenian cultural life',
        transition: 'Begin with broadcast voice, where music and language reached families across the region.',
      },
      {
        inducteeId: 'joe-valencic-2020',
        label: 'Music, history, and Slovenian heritage',
        transition: 'Valencic follows Petkovsek by turning cultural sound into researched history and public memory.',
      },
      {
        inducteeId: 'marilyn-madigan-2019',
        label: 'Irish heritage and cultural continuity',
        transition: 'Madigan broadens the story from one community to the wider work of keeping heritage active.',
      },
      {
        inducteeId: 'erika-puussaar-2024',
        label: 'Estonian heritage and garden stewardship',
        transition: 'Puussaar moves the journey outdoors, where culture takes permanent shape in the gardens.',
      },
      {
        inducteeId: 'johnny-k-wu-2024',
        label: 'Film, media, and Asian community storytelling',
        transition: 'Wu shows how contemporary media lets communities tell their own stories in public.',
      },
      {
        inducteeId: 'svetlana-stolyarova-2025',
        label: 'Russian cultural garden and festival leadership',
        transition: 'Stolyarova connects garden stewardship to festival life and international cultural exchange.',
      },
      {
        inducteeId: 'branka-malinar-2025',
        label: 'Croatian cultural preservation and community arts',
        transition: 'Malinar closes the journey with preservation as both performance, restoration, and education.',
      },
      {
        inducteeId: 'andy-fedynsky-2026',
        label: 'Ukrainian museum stewardship and advocacy',
        transition: 'Fedynsky leaves visitors with culture as archive, witness, and civic responsibility.',
      },
    ],
  },
  {
    id: 'who-changed-the-city',
    title: 'WHO CHANGED THE CITY?',
    intro: 'A journey through people who changed Cleveland by strengthening science, education, health care, enterprise, public institutions, and civic imagination.',
    accent: '#2f6f78',
    kind: 'curated',
    startState: 'Start with scientific and industrial leadership, where private achievement becomes public service.',
    endState: 'End with global business education that frames Cleveland inside a wider world.',
    organizations: ['Cleveland Clinic', 'MetroHealth', 'Cleveland State University', 'University communities'],
    places: ['Cleveland State University', 'Downtown Cleveland', 'University Circle'],
    items: [
      {
        inducteeId: 'jeanette-grasselli-brown-2010',
        label: 'Scientific leadership and public service',
        transition: 'Begin with a scientist whose leadership links industry, education, and public responsibility.',
      },
      {
        inducteeId: 'monte-ahuja-2014',
        label: 'Entrepreneurship, education, and philanthropy',
        transition: 'Ahuja follows by showing how enterprise can become investment in educational opportunity.',
      },
      {
        inducteeId: 'dick-pogue-2015',
        label: 'Civic leadership and institutional transformation',
        transition: 'Pogue carries the story into the boardrooms and civic tables where institutions are reshaped.',
      },
      {
        inducteeId: 'akram-boutros-2019',
        label: 'Healthcare leadership and public systems',
        transition: 'Boutros turns institutional change toward health systems and the people they serve.',
      },
      {
        inducteeId: 'sree-sreenath-2019',
        label: 'Engineering, education, and global service',
        transition: 'Sreenath expands city change through engineering, teaching, and international service networks.',
      },
      {
        inducteeId: 'dr-eugene-jordan-2024',
        label: 'Medical excellence and mentorship',
        transition: 'Jordan brings systems change back to human mentorship and the training of future caregivers.',
      },
      {
        inducteeId: 'raj-aggarwal-2025',
        label: 'Academic leadership and global business insight',
        transition: 'Aggarwal closes by connecting Cleveland learning to global business and civic perspective.',
      },
    ],
  },
  {
    id: 'what-survives-migration',
    title: 'WHAT SURVIVES MIGRATION?',
    intro: 'A journey about what people carry across distance: memory, language, foodways, gardens, archives, festivals, faith, and a responsibility to remember.',
    accent: '#76619a',
    kind: 'curated',
    startState: 'Start with the archive: what survives must first be gathered, named, and protected.',
    endState: 'End with family and community memory becoming a public story for Cleveland.',
    organizations: ['Greater Cleveland Ethnographic Museum', 'Cleveland Cultural Gardens Federation', 'Ukrainian Museum-Archives'],
    places: ['Greater Cleveland Ethnographic Museum', 'Cleveland Cultural Gardens', 'Norwegian community sites'],
    items: [
      {
        inducteeId: 'august-pust-2010',
        label: 'Ethnographic memory and community history',
        transition: 'Begin with the question of preservation: which records, objects, and stories will survive?',
      },
      {
        inducteeId: 'ingrida-bublys-2019',
        label: 'Lithuanian leadership and international bridge-building',
        transition: 'Bublys follows by showing that memory also survives through business, diplomacy, and networks.',
      },
      {
        inducteeId: 'pierre-bejjani-2023',
        label: 'Lebanese community leadership and global ties',
        transition: 'Bejjani moves the journey toward community institutions that keep homeland ties active.',
      },
      {
        inducteeId: 'erika-puussaar-2024',
        label: 'Estonian heritage and cultural garden stewardship',
        transition: 'Puussaar shows how migration memory becomes visible in a permanent public garden.',
      },
      {
        inducteeId: 'svetlana-stolyarova-2025',
        label: 'Russian music, festivals, and cultural garden work',
        transition: 'Stolyarova turns memory into recurring public celebration and artistic exchange.',
      },
      {
        inducteeId: 'catherine-jorgensen-mccutcheon-2026',
        label: 'Norwegian heritage and community history',
        transition: 'Jorgensen McCutcheon brings the focus to family history and the long work of community storytelling.',
      },
      {
        inducteeId: 'andy-fedynsky-2026',
        label: 'Ukrainian museum stewardship and advocacy',
        transition: 'Fedynsky closes with survival as witness: archives can preserve culture during crisis.',
      },
    ],
  },
  {
    id: 'who-spoke-for-their-community',
    title: 'WHO SPOKE FOR THEIR COMMUNITY?',
    intro: 'A journey through public voices: faith leaders, lawyers, advocates, educators, media makers, and organizers who spoke when communities needed recognition or protection.',
    accent: '#a8492d',
    kind: 'curated',
    startState: 'Start with moral voice: public speech can call a city to account.',
    endState: 'End with community service that turns voice into durable civic presence.',
    organizations: ['Civil rights organizations', 'Immigrant advocacy organizations', 'Esperanza', 'Puerto Rican community organizations'],
    places: ['Churches', 'City Hall', 'Neighborhood schools'],
    items: [
      {
        inducteeId: 'reverend-dr-otis-moss-jr-2011',
        label: 'Faith, civil rights, and civic voice',
        transition: 'Begin with a voice rooted in faith and civil rights, speaking to the conscience of the city.',
      },
      {
        inducteeId: 'margaret-w-wong-2010',
        label: 'Immigration law and public advocacy',
        transition: 'Wong follows by giving voice to people navigating immigration systems.',
      },
      {
        inducteeId: 'vijaya-l-emani-2011',
        label: 'Advocacy against domestic violence',
        transition: 'Emani shifts the journey to voices that protect people inside families and communities.',
      },
      {
        inducteeId: 'tony-petkovsek-2011',
        label: 'Broadcasting and cultural representation',
        transition: 'Petkovsek shows how media can speak with and for a cultural community.',
      },
      {
        inducteeId: 'victor-ruiz-2022',
        label: 'Education, equity, and Latino leadership',
        transition: 'Ruiz carries public voice into education, where advocacy shapes future opportunity.',
      },
      {
        inducteeId: 'veronica-dahlberg-2024',
        label: 'Worker justice and immigrant rights',
        transition: 'Dahlberg makes community voice collective, organized, and focused on worker protection.',
      },
      {
        inducteeId: 'lucy-torres-2026',
        label: 'Puerto Rican community service and leadership',
        transition: 'Torres closes with voice as everyday service and sustained neighborhood leadership.',
      },
    ],
  },
  {
    id: 'how-does-a-city-remember',
    title: 'HOW DOES A CITY REMEMBER?',
    intro: 'A journey about memory work: gardens, archives, libraries, festivals, museums, ceremonies, and people who decide what a city keeps visible.',
    accent: '#b56a2f',
    kind: 'curated',
    startState: 'Start with a civic landscape built to remember many communities at once.',
    endState: 'End with recent stewards who keep memory public, teachable, and unfinished.',
    organizations: ['Cleveland Cultural Gardens Federation', 'Cleveland Public Library', 'Ukrainian Museum-Archives', 'Cleveland International Hall of Fame'],
    places: ['Cleveland Cultural Gardens', 'Cleveland Public Library', 'Ukrainian Museum-Archives', 'Olde Towne Hall Theatre'],
    items: [
      {
        inducteeId: 'leo-weidenthal-2010',
        label: 'Civic memory and the Cultural Gardens',
        transition: 'Begin with the Cultural Gardens as a physical answer to how a city remembers.',
      },
      {
        inducteeId: 'august-pust-2010',
        label: 'Ethnographic museum work and cultural history',
        transition: 'Pust follows by moving memory from landscape to museum and archive.',
      },
      {
        inducteeId: 'joe-valencic-2020',
        label: 'Music, history, and Slovenian heritage',
        transition: 'Valencic shows how music and scholarship keep memory active, not frozen.',
      },
      {
        inducteeId: 'marilyn-madigan-2019',
        label: 'Irish heritage and public tradition',
        transition: 'Madigan brings the journey into festivals and public rituals of belonging.',
      },
      {
        inducteeId: 'beverly-kerecman-2025',
        label: 'Library, history, and community memory',
        transition: 'Kerecman connects cultural memory to public collections and shared research.',
      },
      {
        inducteeId: 'andy-chakalis-2026',
        label: 'Greek heritage and museum education',
        transition: 'Chakalis keeps the question teachable, linking memory to museum interpretation.',
      },
      {
        inducteeId: 'andy-fedynsky-2026',
        label: 'Ukrainian museum stewardship and advocacy',
        transition: 'Fedynsky shows memory as protection when communities face crisis and erasure.',
      },
      {
        inducteeId: 'branka-malinar-2025',
        label: 'Cultural preservation and community arts',
        transition: 'Malinar closes with restoration and performance as living memory visitors can still enter.',
      },
    ],
  },
];
