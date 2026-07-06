import Image from "next/image";

export default function HomePage() {
  return (
    <main>
      <nav className="navbar">
        <a href="#start" className="navLogo">
          Spełniaj Marzenia
        </a>

        <div className="navLinks">
          <a href="#onas">O nas</a>
          <a href="#dzialania">Działania</a>
          <a href="#galeria">Galeria</a>
          <a href="#facebook">Facebook</a>
          <a href="#kontakt">Kontakt</a>
        </div>

        <a href="#kontakt" className="navButton">
          Wesprzyj
        </a>
      </nav>

      <section className="hero" id="start">
        <Image
          src="/hero/niebo.webp"
          alt="Błękitne niebo"
          fill
          priority
          className="heroImage"
        />

        <div className="mist mistOne" />
        <div className="mist mistTwo" />
        <div className="mist mistThree" />

        <div className="heroContent">
          <Image
            src="/images/logo/logo-spelniaj-marzenia.png"
            alt="Logo Stowarzyszenia Spełniaj Marzenia"
            width={150}
            height={150}
            priority
            className="heroLogo"
          />

          <h1>Razem możemy więcej</h1>
          <p className="heroSubtitle">Spełniamy marzenia każdego dnia</p>

          <div className="heroValues">
            <div>
              <span>♡</span>
              <strong>Pomagamy</strong>
              <p>Wspieramy tych, którzy tego najbardziej potrzebują.</p>
            </div>

            <div>
              <span>☁</span>
              <strong>Inspirujemy</strong>
              <p>Motywujemy do działania i wierzenia w siebie.</p>
            </div>

            <div>
              <span>☼</span>
              <strong>Zmieniamy świat</strong>
              <p>Tworzymy lepszą przyszłość dla nas wszystkich.</p>
            </div>
          </div>

          <a href="#kontakt" className="heroButton">
            Dołącz do nas
          </a>
        </div>
      </section>

      <section className="section" id="onas">
        <h2>O nas</h2>
        <p>
          Stowarzyszenie Spełniaj Marzenia powstało po to, by pomagać,
          inspirować i dawać nadzieję osobom, które jej najbardziej potrzebują.
        </p>
      </section>

      <section className="section" id="dzialania">
        <h2>Nasze działania</h2>

        <div className="cards">
          <article>
            <h3>Pomoc</h3>
            <p>Wspieramy osoby i rodziny w trudnych momentach.</p>
          </article>

          <article>
            <h3>Wydarzenia</h3>
            <p>Organizujemy spotkania, akcje i inicjatywy społeczne.</p>
          </article>

          <article>
            <h3>Wspólnota</h3>
            <p>Łączymy ludzi, którzy chcą robić coś dobrego.</p>
          </article>
        </div>
      </section>

      <section className="section softSection" id="galeria">
        <h2>Galeria</h2>
        <p>
          Tu pojawią się zdjęcia z wydarzeń i działań Stowarzyszenia.
        </p>
      </section>

      <section className="section facebook" id="facebook">
        <h2>Aktualności</h2>
        <p>
          Bieżące informacje, zapowiedzi i relacje publikujemy na Facebooku.
        </p>
        <a href="#" className="button">
          Przejdź na Facebook
        </a>
      </section>

      <section className="section contact" id="kontakt">
        <h2>Kontakt</h2>

        <form>
          <input type="text" placeholder="Imię i nazwisko" />
          <input type="email" placeholder="Adres e-mail" />
          <input type="text" placeholder="Temat wiadomości" />
          <textarea placeholder="Treść wiadomości" />

          <label>
            <input type="checkbox" />
            Wyrażam zgodę na kontakt w odpowiedzi na przesłaną wiadomość.
          </label>

          <button type="submit">Wyślij wiadomość</button>
        </form>
      </section>
<footer>
  <p>© 2026</p>

  <p>
    <a
      href="https://www.grzadkowisko.pl/"
      target="_blank"
      rel="noopener noreferrer"
      className="authorLink"
    >
      Emilia Olszewska
    </a>
  </p>

  <p>
    Projekt i wykonanie strony internetowej dla<br />
    Stowarzyszenia Spełniaj Marzenia
  </p>
</footer>
    </main>
  );
}
