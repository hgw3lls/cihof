export type JourneyItem = {
  inducteeId: string;
  label: string;
};

export type Journey = {
  id: string;
  title: string;
  intro: string;
  accent: string;
  items: JourneyItem[];
};

export const journeys: Journey[] = [
  {
    id: 'trailblazers',
    title: 'Trailblazers',
    intro: 'People whose work opened doors across civic life, business, science, media, and community leadership.',
    accent: '#b73e2f',
    items: [
      { inducteeId: 'jeanette-grasselli-brown-2010', label: 'Scientific leadership and public service' },
      { inducteeId: 'margaret-w-wong-2010', label: 'Immigration law and community advocacy' },
      { inducteeId: 'reverend-dr-otis-moss-jr-2011', label: 'Faith, civil rights, and civic voice' },
      { inducteeId: 'vijaya-l-emani-2011', label: 'Advocacy against domestic violence' },
      { inducteeId: 'sister-alicia-alvarado-2018', label: 'Service through education and community care' },
      { inducteeId: 'veronica-dahlberg-2024', label: 'Worker justice and immigrant rights' },
    ],
  },
  {
    id: 'civic-builders',
    title: 'Civic Builders',
    intro: 'Leaders who shaped institutions, neighborhoods, public service, and the civic fabric of Cleveland.',
    accent: '#1f6f78',
    items: [
      { inducteeId: 'senator-george-voinovich-2010', label: 'Public leadership from Cleveland to the nation' },
      { inducteeId: 'ralph-j-perk-2011', label: 'City leadership and ethnic community visibility' },
      { inducteeId: 'hon-mary-rose-oakar-2012', label: 'Public service and national representation' },
      { inducteeId: 'valarie-mccall-2020', label: 'Cleveland civic strategy and public affairs' },
      { inducteeId: 'michael-d-polensek-2023', label: 'Neighborhood-centered civic service' },
      { inducteeId: 'mayor-frank-jackson-2025', label: 'Long-serving city leadership' },
    ],
  },
  {
    id: 'arts-culture',
    title: 'Arts & Culture',
    intro: 'Storytellers, organizers, and cultural stewards who helped communities see themselves in Cleveland.',
    accent: '#765a9a',
    items: [
      { inducteeId: 'tony-petkovsek-2011', label: 'Broadcasting and Slovenian cultural life' },
      { inducteeId: 'dick-russ-2015', label: 'Journalism and public storytelling' },
      { inducteeId: 'joe-valencic-2020', label: 'Music, history, and Slovenian heritage' },
      { inducteeId: 'marilyn-madigan-2019', label: 'Irish heritage and cultural continuity' },
      { inducteeId: 'johnny-k-wu-2024', label: 'Film, media, and Asian community storytelling' },
      { inducteeId: 'branka-malinar-2025', label: 'Cultural preservation and community arts' },
    ],
  },
  {
    id: 'science-education',
    title: 'Science, Medicine & Education',
    intro: 'Innovators and educators whose work strengthened knowledge, health, enterprise, and opportunity.',
    accent: '#6e7f32',
    items: [
      { inducteeId: 'dr-jaya-shah-2012', label: 'Medicine and community service' },
      { inducteeId: 'monte-ahuja-2014', label: 'Entrepreneurship, education, and philanthropy' },
      { inducteeId: 'akram-boutros-2019', label: 'Healthcare leadership and public systems' },
      { inducteeId: 'sree-sreenath-2019', label: 'Engineering, education, and global service' },
      { inducteeId: 'dr-eugene-jordan-2024', label: 'Medical excellence and mentorship' },
      { inducteeId: 'raj-aggarwal-2025', label: 'Academic leadership and global business insight' },
    ],
  },
  {
    id: 'global-cleveland',
    title: 'Global Cleveland',
    intro: 'International bridges, cultural gardens, diplomacy, and immigrant stories that make Cleveland globally connected.',
    accent: '#b56a2f',
    items: [
      { inducteeId: 'ingrida-bublys-2019', label: 'International business and Lithuanian leadership' },
      { inducteeId: 'victor-ruiz-2022', label: 'Education, equity, and Latino leadership' },
      { inducteeId: 'pierre-bejjani-2023', label: 'Lebanese community leadership and global ties' },
      { inducteeId: 'ambassador-edward-f-crawford-2024', label: 'Diplomacy and international service' },
      { inducteeId: 'erika-puussaar-2024', label: 'Estonian heritage and cultural garden stewardship' },
      { inducteeId: 'svetlana-stolyarova-2025', label: 'Arts, culture, and global community connection' },
    ],
  },
  {
    id: 'recent-honorees',
    title: 'Recent Honorees',
    intro: 'A path through the newest classes, showing how the Hall of Fame continues to evolve.',
    accent: '#2f6f9f',
    items: [
      { inducteeId: 'dona-brady-2024', label: 'Community and civic leadership' },
      { inducteeId: 'erika-puussaar-2024', label: 'Estonian cultural leadership' },
      { inducteeId: 'johnny-k-wu-2024', label: 'Media and cultural storytelling' },
      { inducteeId: 'beverly-kerecman-2025', label: 'Public service and community leadership' },
      { inducteeId: 'david-gilbert-2025', label: 'Civic, tourism, and institutional leadership' },
      { inducteeId: 'mayor-frank-jackson-2025', label: 'City leadership and public service' },
    ],
  },
];
