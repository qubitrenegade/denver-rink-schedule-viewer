// About page for the Denver Rink Schedule Viewer

const GITHUB_URL = "https://github.com/qubitrenegade/denver-rink-schedule-viewer";

export default function About() {
  return (
    <div className="text-slate-200">
      <p className="mb-4">
        This project helps you view and search public skating and hockey schedules for Denver-area rinks.
      </p>
      <p className="mb-4">
        <a 
          href={GITHUB_URL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline transition-colors"
        >
          View source or request a feature on GitHub
        </a>
      </p>
      <p className="text-sm text-slate-400">
        Created by{' '}
        <a 
          href="https://github.com/qubitrenegade" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline transition-colors"
        >
          @qubitrenegade
        </a>
      </p>
    </div>
  );
}
