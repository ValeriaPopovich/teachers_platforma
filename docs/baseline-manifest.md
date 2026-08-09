# Baseline manifest

Зафиксированные ожидаемые результаты для [`tests/fixtures/baseline.json`](../tests/fixtures/baseline.json). Числа посчитаны вручную из текущей логики `index.html` и служат эталоном: рефактор не должен их менять (см. [REFACTORING_SPEC.md](./REFACTORING_SPEC.md) §4.1, ADR-0005).

## Количество сущностей

| Коллекция | Кол-во |
|---|---|
| students | 5 |
| groups | 1 |
| lessons | 19 (из них done/paid_missed: 15, planned: 4) |
| events | 1 |
| payments | 7 (из них ledgerOnly: 1) |
| financeArchive (ключей) | 1 |
| topicLog (ключей) | 1 |

## Финансы по ученикам

Формула (single): `charged = archive.singleCharged + Σ(unpaid done.amount)`, `paid = archive.paidAmount + Σ(balancePayments.amount)`, `balance = paid − charged`, `debt = max(0, charged − paid)`. Занятия и платежи до `billingSince` и платежи с `ledgerOnly` исключаются.

Формула (package): `bought = archive.packageBought + Σ(payment.packageLessons | student.packageSize)`, `used = archive.packageUsed + count(done c payment='package')`, `balanceLessons = bought − used`, `charged = used × price`, `debt = max(0, −balanceLessons) × price`.

| Ученик | Тип | charged | paid | balance | debt | balanceLessons | bought | used |
|---|---|---|---|---|---|---|---|---|
| s-single-debt | single | 3000 | 2000 | −1000 | 1000 | — | — | — |
| s-single-advance | single | 1000 | 1500 | 500 | 0 | — | — | — |
| s-single-billing | single | 1000 | 1200 | 200 | 0 | — | — | — |
| s-pack | package | 2400 | 6400 | 0 | 0 | 5 | 8 | 3 |
| s-pack-archive | package | 5000 | 4000 | 0 | 1000 | −2 | 8 | 10 |

Пояснения к «ловушкам» fixture:

- **s-single-debt**: занятие `l-sd-paid` (done/paid) нейтрально — не попадает в `charged` (учитываются только `unpaid`) и не имеет платежа. `l-sd-future` (planned) исключено.
- **s-single-advance**: платёж `p-sa-ledger` (`ledgerOnly:true`, 9999) исключён из `paid`.
- **s-single-billing**: `billingSince = 1780272000000` (2026-06-01). Занятие и платёж от 2026-05-15 исключены, от 2026-07-15 — учтены.
- **s-pack-archive**: смешивает `financeArchive` (bought 4 / used 4 / paid 2000) с новым платежом (4 занятия, 2000) и 6 проведёнными занятиями → долг за 2 занятия.

## Ещё не покрыто baseline (следующие шаги)

- аналитика за период (`periodAnalytics`) — добавить в manifest и тесты;
- групповые занятия с индивидуальным типом оплаты участников (нужно проследить `syncFutureGroupBilling`/`applyStudentBilling`);
- расписание: генерация регулярных занятий, идемпотентность, конфликты (`generateSchedule`, `extendAllSchedules`);
- backup replace/merge (remap ссылок, recovery copy).

Эти части фиксируются на Этапе 4 вместе с извлечением соответствующих модулей.
