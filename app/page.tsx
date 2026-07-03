import Image from "next/image";

export default function HomePage() {
  return (
    <main>
      <section className="hero" id="start">
        <Image
          src="/images/hero/hero-marzenia.png"
          alt="Stowarzyszenie Spełniaj Marzenia"
          fill
          priority
          className="heroImage"
        />
      </section>

      <section className="section" id="onas">
        <h2>O nas</h2>
        <p>
          Stowarzyszenie Spełniaj Marzenia powstało po to, by pomagać,
          inspirować i dawać nadzieję tym, którzy jej najbardziej potrzebują.
        </p>
      </section>

      <section className="section cards" id="dzialania">
        <h2>Nasze działania</h2>

        <div className="cardGrid">
          <article>
            <h3>Pomagamy</h3>
            <p>Wspieramy osoby i rodziny w trudnych momentach.</p>
          </article>

          <article>
            <h3>Inspirujemy</h3>
            <p>Motywujemy do działania i wiary w lepsze jutro.</p>
          </article>

          <article>
            <h3>Zmieniamy świat</h3>
            <p>Budujemy wspólnotę opartą na dobroci i wsparciu.</p>
          </article>
        </div>
      </section>

      <section className="section" id="galeria">
        <h2>Galeria</h2>
        <p>Tu pojawią się zdjęcia z działań Stowarzyszenia.</p>
      </section>

      <section className="section facebook" id="facebook">
        <h2>Aktualności</h2>
        <p>Nasze bieżące działania publikujemy na Facebooku.</p>
        <a href="#" className="button">Przejdź na Facebook</a>
      </section>

      <section className="section contact" id="kontakt">
        <h2>Kontakt</h2>

        <form>
          <input type="text" placeholder="Imię i nazwisko" />
          <input type="email" placeholder="Adres e-mail" />
          <textarea placeholder="Treść wiadomości" />

          <label className="rodo">
            <input type="checkbox" />
            Wyrażam zgodę na kontakt w odpowiedzi na wiadomość.
          </label>

          <button type="submit">Wyślij wiadomość</button>
        </form>
      </section>

      <footer>
        © Stowarzyszenie Spełniaj Marzenia
      </footer>
    </main>
  );
}
