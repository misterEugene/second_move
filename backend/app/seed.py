from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from .db import SessionLocal
from .models import (
    Application, ApplicationStatus, Category, Event, Notification, Organization, Participation, Review, Role, Shift,
    User, VolunteerHours,
)
from .security import hash_password
from .services import get_or_create_skills, today_utc

MSK = timezone(timedelta(hours=3))

EVENTS = [
    ("eco", "Субботник в городском парке", Category.ECOLOGY, 5, "Ростов-на-Дону", "Центральный парк", 20,
     "Приглашаем всех желающих присоединиться к экологической акции по уборке территории Центрального парка. Вместе мы сделаем наш город чище и уютнее!",
     "Удобная одежда и обувь\nЖелание помогать\nПо возможности — перчатки (будет ограниченное количество)",
     ["Командная работа", "Ответственность", "Физическая активность"], [(9, 13, 12), (14, 17, 8)]),
    ("care", "Помощь приюту для животных", Category.ANIMALS, 3, "Ростов-на-Дону", "ул. Приютская, 12", 15,
     "Выгул собак, уборка вольеров и помощь с кормлением. Опыт не нужен — кураторы приюта всё покажут на месте.",
     "Одежда, которую не жалко испачкать\nВозраст 16+", ["Любовь к животным", "Ответственность"], [(10, 14, 15)]),
    ("kids", "Мастер-класс по робототехнике для детей", Category.EDUCATION, 8, "Краснодар", "ул. Школьная, 5", 10,
     "Помогите провести мастер-класс для детей 8–12 лет: собираем простых роботов и учимся их программировать.",
     "Терпение и доброжелательность\nБазовые знания в технике будут плюсом", ["Работа с детьми", "Педагогика"],
     [(12, 16, 10)]),
    ("care", "Поддержка пожилых людей", Category.SOCIAL, 10, "Ростов-на-Дону", "ул. Ленина, 28", 12,
     "Навещаем подопечных фонда: помогаем с покупками, общаемся, читаем вслух. Каждая встреча очень важна для них.",
     "Доброжелательность\nПунктуальность", ["Коммуникабельность", "Эмпатия"], [(10, 13, 6), (13, 15, 6)]),
    ("care", "Донорская акция", Category.HEALTH, 12, "Ростов-на-Дону", "ул. Медицинская, 7", 30,
     "Нужны волонтёры для регистрации доноров, навигации и помощи на пункте питания во время донорской акции.",
     "Аккуратность\nГотовность работать с людьми", ["Коммуникабельность", "Организованность"], [(9, 14, 30)]),
    ("kids", "Организация городского фестиваля", Category.CULTURE, 15, "Краснодар", "Набережная", 25,
     "Встречаем гостей, помогаем на площадках и мастер-классах, следим за порядком на фестивале уличной культуры.",
     "Хорошее настроение\nУдобная обувь", ["Организованность", "Командная работа"], [(11, 15, 15), (15, 18, 10)]),
    ("eco", "Благотворительный забег «Зелёная миля»", Category.SPORT, 20, "Ростов-на-Дону", "Левобережный парк", 18,
     "Волонтёры нужны на старте, финише и пунктах питания. Все собранные средства пойдут на высадку деревьев.",
     "Возраст 16+", ["Физическая активность", "Командная работа"], [(8, 12, 18)]),
    ("eco", "Высадка деревьев во дворах", Category.ECOLOGY, -14, "Ростов-на-Дону", "ул. Садовая, 40", 10,
     "Высаживаем молодые липы и клёны во дворах исторического центра вместе с жителями района.",
     "Перчатки", ["Физическая активность"], [(10, 16, 10)]),
    ("care", "Сбор вещей для подопечных", Category.SOCIAL, -7, "Ростов-на-Дону", "ул. Ленина, 28", 8,
     "Сортируем и упаковываем собранную одежду и предметы первой необходимости для семей подопечных фонда.",
     "Аккуратность", ["Организованность"], [(10, 14, 8)]),
    ("kids", "Урок финансовой грамотности", Category.EDUCATION, -5, "Краснодар", "ул. Школьная, 5", 6,
     "Проводим интерактивный урок о карманных деньгах и планировании бюджета для школьников 10–14 лет.",
     "Опыт выступлений будет плюсом", ["Педагогика"], [(12, 16, 6)]),
]


def main() -> None:
    db = SessionLocal()
    if db.scalar(select(func.count()).select_from(User)):
        print("База уже содержит данные — сид пропущен")
        return

    password_hash = hash_password("password123")
    today = today_utc()

    def user(email, name, role, city="Ростов-на-Дону"):
        u = User(email=email, name=name, role=role, city=city, password_hash=password_hash)
        db.add(u)
        return u

    user("admin@dobro.local", "Администратор", Role.ADMIN)
    ivan = user("ivan@dobro.local", "Иван Петров", Role.VOLUNTEER)
    anna = user("anna@dobro.local", "Анна Соколова", Role.VOLUNTEER)
    dmitry = user("dmitry@dobro.local", "Дмитрий Кузнецов", Role.VOLUNTEER)
    elena = user("elena@dobro.local", "Елена Васильева", Role.VOLUNTEER, "Краснодар")

    orgs = {
        "eco": Organization(
            owner=user("eco@dobro.local", "Мария Орлова", Role.ORGANIZER), name="Городской центр экологии",
            city="Ростов-на-Дону",
            description="Экологические инициативы и просвещение: субботники, раздельный сбор, озеленение дворов."),
        "care": Organization(
            owner=user("care@dobro.local", "Сергей Лебедев", Role.ORGANIZER), name="Фонд «Тёплые руки»",
            city="Ростов-на-Дону",
            description="Помогаем пожилым людям, приютам для животных и организуем донорские акции."),
        "kids": Organization(
            owner=user("kids@dobro.local", "Ольга Миронова", Role.ORGANIZER, "Краснодар"),
            name="Клуб «Знание — детям»", city="Краснодар",
            description="Мастер-классы, наставничество и культурные события для детей и подростков."),
    }
    db.add_all(orgs.values())

    events: dict[str, Event] = {}
    for org, title, category, days, city, address, limit, description, requirements, skills, shifts in EVENTS:
        day = today + timedelta(days=days)
        event = Event(
            organization=orgs[org], title=title, category=category, date=day, city=city, address=address,
            limit=limit, description=description, requirements=requirements,
            skills=get_or_create_skills(db, skills),
            shifts=[
                Shift(
                    start_at=datetime(day.year, day.month, day.day, start, tzinfo=MSK),
                    end_at=datetime(day.year, day.month, day.day, end, tzinfo=MSK),
                    capacity=capacity,
                )
                for start, end, capacity in shifts
            ],
        )
        db.add(event)
        db.flush()
        events[title] = event

    done = [
        (ivan, "Высадка деревьев во дворах", "6", 5, "Отличная организация, всё было продумано. Обязательно приду ещё!"),
        (ivan, "Сбор вещей для подопечных", "4", 4, "Тёплая атмосфера и понятные задачи."),
        (ivan, "Урок финансовой грамотности", "4", None, None),
        (anna, "Высадка деревьев во дворах", "6", 4, "Немного не хватило инвентаря, но в целом здорово."),
        (dmitry, "Сбор вещей для подопечных", "3.5", None, None),
    ]
    for volunteer, title, hours, rating, text in done:
        e = events[title]
        owner_id = e.organization.owner_id
        app = Application(event=e, volunteer=volunteer, status=ApplicationStatus.APPROVED, shift=e.shifts[0])
        p = Participation(application=app, attended=True, marked_by=owner_id)
        db.add_all([app, p, VolunteerHours(participation=p, hours=Decimal(hours), confirmed_by=owner_id)])
        if rating:
            db.add(Review(event=e, volunteer=volunteer, rating=rating, text=text))

    park = events["Субботник в городском парке"]
    shelter = events["Помощь приюту для животных"]
    robots = events["Мастер-класс по робототехнике для детей"]
    A = ApplicationStatus
    db.add_all([
        Application(event=park, volunteer=ivan, status=A.APPROVED, shift=park.shifts[0]),
        Application(event=park, volunteer=anna, status=A.APPROVED, shift=park.shifts[0]),
        Application(event=park, volunteer=dmitry, status=A.PENDING, message="Хочу помочь, есть свои перчатки."),
        Application(event=park, volunteer=elena, status=A.PENDING),
        Application(event=shelter, volunteer=ivan, status=A.PENDING),
        Application(event=shelter, volunteer=anna, status=A.APPROVED),
        Application(event=robots, volunteer=ivan, status=A.REJECTED),
    ])
    db.add_all([
        Notification(user_id=ivan.id, text="Заявка на «Субботник в городском парке» одобрена. Выберите удобную смену.",
                     link=f"/events/{park.id}"),
        Notification(user_id=ivan.id, text="Подтверждено 6 ч за «Высадка деревьев во дворах». Спасибо!",
                     link="/cabinet/hours", is_read=True),
        Notification(user_id=orgs["eco"].owner_id, text=f"Новая заявка от {dmitry.name} на «{park.title}»",
                     link=f"/organizer/events/{park.id}"),
    ])
    db.commit()
    print("Демо-данные созданы. Пароль у всех пользователей: password123")


if __name__ == "__main__":
    main()
