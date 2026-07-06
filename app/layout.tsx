import Image from "next/image";

export default function HomePage() {
  return (
    <main>
      <section className="hero" id="start">
        <Image
          src="/images/hero/niebo.jpeg"
          alt="Błękitne niebo"
          fill
          priority
          className="heroImage"
        />

        <div className="mist mistOne" />
        <div className="mist mistTwo" />

        <div className="heroContent">
          <Image
            src="/logo/logo-spelniaj-marzenia.png"
            alt="Logo Stowarzyszenia Spełniaj Marzenia"
            width={140}
            height={140}
            className="logo"
          />

          <h1>Razem możemy więcej</h1>
          <p className="subtitle">Spełniamy marzenia każdego dnia</p>

          <div className="heroIcons">
            <div>
              <span>♡</span>
              <h3>Pomagamy</h3>
              <p>Wspieramy tych, którzy tego najbardziej potrzebują.</p>
            </div>

            <div>
              <span>☁</span>
              <h3>Inspirujemy</h3>
              <p>Motywujemy do działania i wierzenia w siebie.</p>
            </div>

            <div>
              <span>☝</span>
              <h3>Zmieniamy świat</h3>
              <p>Tworzymy lepszą przyszłość dla nas wszystkich.</p>
            </div>
          </div>

          <a href="#kontakt" className="heroButton">
            Dołącz do nas
          </a>
        </div>
      </section>
    </main>
  );
}
