const YearMenu = ({
  years,
  activeYear,
  onSelectYear,
}: {
  years: string[];
  activeYear: string;
  onSelectYear: (year: string) => void;
}) => {
  return (
    <nav className="year-menu" aria-label="Year menu">
      {years.map((year) => (
        <button
          key={year}
          type="button"
          className={`year-menu__button${activeYear === year ? ' year-menu__button--active' : ''}`}
          onClick={() => onSelectYear(year)}
          aria-pressed={activeYear === year}
        >
          {year}
        </button>
      ))}
    </nav>
  );
};

export default YearMenu;
