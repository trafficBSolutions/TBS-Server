// South GA counties: Macon-Bibb and everything south of the Columbus-Sandersville-Waynesboro-Augusta line
const SOUTH_GA_COUNTIES = [
  'Appling', 'Atkinson', 'Bacon', 'Baker', 'Ben Hill', 'Berrien', 'Bibb',
  'Bleckley', 'Brantley', 'Brooks', 'Bryan', 'Bulloch', 'Burke',
  'Calhoun', 'Camden', 'Candler', 'Charlton', 'Chatham', 'Chattahoochee',
  'Clinch', 'Coffee', 'Colquitt', 'Cook', 'Crisp', 'Decatur', 'Dodge',
  'Dooly', 'Dougherty', 'Early', 'Echols', 'Effingham', 'Emanuel',
  'Evans', 'Glascock', 'Glynn', 'Grady', 'Houston', 'Irwin',
  'Jeff Davis', 'Jefferson', 'Jenkins', 'Johnson', 'Laurens', 'Lee',
  'Liberty', 'Long', 'Lowndes', 'Macon', 'Marion', 'McIntosh',
  'Miller', 'Mitchell', 'Montgomery', 'Muscogee', 'Peach', 'Pierce',
  'Pulaski', 'Quitman', 'Randolph', 'Richmond', 'Schley', 'Screven',
  'Seminole', 'Stewart', 'Sumter', 'Talbot', 'Tattnall', 'Taylor',
  'Telfair', 'Terrell', 'Thomas', 'Tift', 'Toombs', 'Treutlen',
  'Turner', 'Twiggs', 'Ware', 'Washington', 'Wayne', 'Webster',
  'Wheeler', 'Wilcox', 'Wilkinson', 'Worth', 'Columbia', 'McDuffie',
  'Lincoln', 'Hancock', 'Baldwin', 'Jones', 'Monroe', 'Crawford',
  'Lanier', 'Lowndes'
];

const getRegionFromCounty = (county) => {
  if (!county) return 'north';
  const normalized = county.replace(/\s*county$/i, '').trim();
  const isSouth = SOUTH_GA_COUNTIES.some(
    c => c.toLowerCase() === normalized.toLowerCase()
  );
  return isSouth ? 'south' : 'north';
};

module.exports = { SOUTH_GA_COUNTIES, getRegionFromCounty };
