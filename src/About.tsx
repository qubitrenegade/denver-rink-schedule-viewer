// About page for the Denver Rink Schedule Viewer

const GITHUB_URL = "https://github.com/qbrd/denver-rink-schedule-viewer";

export default function About() {
  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem" }}>
      <h1>About Denver Rink Schedule Viewer</h1>
      <p>
        This project helps you view and search public skating and hockey schedules for Denver-area rinks.
      </p>
      <p>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          View source or request a feature on GitHub
        </a>
      </p>
      <p>
        Created by <a href="https://github.com/qbrd" target="_blank" rel="noopener noreferrer">@qbrd</a>
      </p>
    </div>
  );
}
