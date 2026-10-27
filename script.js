function parseNumber(value, label, options = {}) {
  const normalized = typeof value === "string"
    ? value.trim().replace(/\s/g, "").replace(",", ".")
    : value;
  const number = normalized === "" ? 0 : Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(label + " muss eine gültige Zahl sein.");
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(label + " darf nicht kleiner als " + options.min + " sein.");
  }
  if (options.max !== undefined && number > options.max) {
    throw new Error(label + " darf höchstens " + options.max + " sein.");
  }
  if (options.integer && !Number.isInteger(number)) {
    throw new Error(label + " muss eine ganze Zahl sein.");
  }
  return number;
}

function calculateGeneral(values) {
  const oneTime = parseNumber(values.oneTime, "Einmalige Kosten", { min: 0 });
  const monthly = parseNumber(values.monthly, "Monatliche Kosten", { min: 0 });
  const annual = parseNumber(values.annual, "Jährliche Kosten", { min: 0 });
  const extra = parseNumber(values.extra, "Zusatzkosten", { min: 0 });
  const discount = parseNumber(values.discount, "Rabatt", { min: 0, max: 100 });
  const duration = parseNumber(values.duration, "Laufzeit", { min: 1, integer: true });

  if (values.durationUnit !== "months" && values.durationUnit !== "years") {
    throw new Error("Bitte wähle eine gültige Laufzeiteinheit.");
  }

  const months = values.durationUnit === "years" ? duration * 12 : duration;
  const monthlyTotal = monthly * months;
  const annualTotal = annual * (months / 12);
  const discountAmount = (oneTime + extra) * (discount / 100);
  const total = oneTime + extra + monthlyTotal + annualTotal - discountAmount;

  if (![total, monthlyTotal, annualTotal, discountAmount].every(Number.isFinite)) {
    throw new Error("Die eingegebenen Werte sind zu groß für eine sichere Berechnung.");
  }

  return {
    total,
    monthlyAverage: total / months,
    yearlyAverage: total / (months / 12),
    discountAmount,
    oneTime,
    monthlyTotal,
    annualTotal,
    extra,
    duration,
    durationUnit: values.durationUnit,
    months
  };
}

function calculateElectricity(values) {
  const annualKwh = parseNumber(values.annualKwh, "Stromverbrauch pro Jahr", { min: 0 });
  const pricePerKwh = parseNumber(values.pricePerKwh, "Arbeitspreis je Kilowattstunde", { min: 0 });
  const monthlyBaseFee = parseNumber(values.monthlyBaseFee, "Grundpreis pro Monat", { min: 0 });
  const monthlyMeterFee = parseNumber(values.monthlyMeterFee, "Zähler- und Messstellengebühr", { min: 0 });
  const monthlyOtherFees = parseNumber(values.monthlyOtherFees, "Weitere feste Gebühren", { min: 0 });
  const annualOtherFees = parseNumber(values.annualOtherFees, "Weitere Jahresgebühren", { min: 0 });
  const oneTimeFees = parseNumber(values.oneTimeFees, "Einmalige Gebühren", { min: 0 });
  const durationYears = parseNumber(values.durationYears, "Berechnungszeitraum", { min: 1, max: 60, integer: true });

  const annualEnergyCost = annualKwh * pricePerKwh;
  const annualBaseFee = monthlyBaseFee * 12;
  const annualMeterFee = monthlyMeterFee * 12;
  const annualOtherMonthlyFees = monthlyOtherFees * 12;
  const annualTotal = annualEnergyCost + annualBaseFee + annualMeterFee + annualOtherMonthlyFees + annualOtherFees;
  const recurringTotal = annualTotal * durationYears;
  const total = recurringTotal + oneTimeFees;
  const totalKwh = annualKwh * durationYears;

  if (![annualTotal, recurringTotal, total, totalKwh].every(Number.isFinite)) {
    throw new Error("Die eingegebenen Werte sind zu groß für eine sichere Berechnung.");
  }

  return {
    total,
    monthlyAverage: total / (durationYears * 12),
    yearlyAverage: total / durationYears,
    annualEnergyCost,
    annualBaseFee,
    annualMeterFee,
    annualOtherMonthlyFees,
    annualOtherFees,
    recurringTotal,
    oneTimeFees,
    durationYears,
    annualKwh,
    pricePerKwh,
    effectivePricePerKwh: totalKwh > 0 ? total / totalKwh : null
  };
}

function calculateLoan(principal, annualRatePercent, termMonths, ownershipMonths) {
  if (principal === 0) {
    return { payment: 0, interestPaid: 0, monthsPaid: 0, remainingBalance: 0 };
  }

  const monthlyRate = annualRatePercent / 1200;
  const payment = monthlyRate === 0
    ? principal / termMonths
    : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths));
  const monthsPaid = Math.min(termMonths, ownershipMonths);
  let balance = principal;
  let interestPaid = 0;

  for (let month = 0; month < monthsPaid; month += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(balance, payment - interest);
    interestPaid += interest;
    balance = Math.max(0, balance - principalPaid);
  }

  if (![payment, interestPaid, balance].every(Number.isFinite)) {
    throw new Error("Die Finanzierung lässt sich mit diesen Werten nicht berechnen.");
  }

  return { payment, interestPaid, monthsPaid, remainingBalance: balance };
}

function calculateCredit(values) {
  const principal = parseNumber(values.principal, "Kreditsumme", { min: 0 });
  const annualInterestRate = parseNumber(values.annualInterestRate, "Sollzins pro Jahr", { min: 0, max: 100 });
  const termMonths = parseNumber(values.termMonths, "Laufzeit", { min: 1, max: 600, integer: true });
  const monthlyRate = annualInterestRate / 1200;
  const monthlyPayment = principal === 0
    ? 0
    : monthlyRate === 0
      ? principal / termMonths
      : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths));

  if (!Number.isFinite(monthlyPayment)) {
    throw new Error("Der Kredit lässt sich mit diesen Werten nicht berechnen.");
  }

  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let firstMonthInterest = 0;
  let firstMonthPrincipal = 0;
  let periodInterest = 0;
  let periodPrincipal = 0;
  let periodPaid = 0;
  const schedule = [];

  for (let month = 1; month <= termMonths; month += 1) {
    const interest = balance * monthlyRate;
    const actualPayment = month === termMonths
      ? balance + interest
      : Math.min(monthlyPayment, balance + interest);
    const principalPaid = Math.min(balance, Math.max(0, actualPayment - interest));

    if (month === 1) {
      firstMonthInterest = interest;
      firstMonthPrincipal = principalPaid;
    }

    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    totalPaid += actualPayment;
    periodInterest += interest;
    periodPrincipal += principalPaid;
    periodPaid += actualPayment;

    if (month % 12 === 0 || month === termMonths) {
      const year = Math.ceil(month / 12);
      schedule.push({
        period: month % 12 === 0 ? "Jahr " + year : "Jahr " + year + " (bis Monat " + month + ")",
        paid: periodPaid,
        principal: periodPrincipal,
        interest: periodInterest,
        remainingBalance: balance
      });
      periodInterest = 0;
      periodPrincipal = 0;
      periodPaid = 0;
    }
  }

  if (![totalInterest, totalPaid, balance, firstMonthInterest, firstMonthPrincipal].every(Number.isFinite)) {
    throw new Error("Der Kredit lässt sich mit diesen Werten nicht sicher berechnen.");
  }

  return {
    principal,
    annualInterestRate,
    termMonths,
    monthlyPayment,
    totalInterest,
    totalPaid,
    firstMonthInterest,
    firstMonthPrincipal,
    remainingBalance: balance,
    schedule
  };
}

function calculateCar(values) {
  const purchasePrice = parseNumber(values.purchasePrice, "Kaufpreis", { min: 0 });
  const downPayment = parseNumber(values.downPayment, "Anzahlung", { min: 0 });
  const annualInterestRate = parseNumber(values.annualInterestRate, "Sollzins", { min: 0, max: 100 });
  const loanTermMonths = parseNumber(values.loanTermMonths, "Kreditlaufzeit", { min: 1, max: 600, integer: true });
  const ownershipYears = parseNumber(values.ownershipYears, "Besitzdauer", { min: 1, max: 40, integer: true });
  const annualInsurance = parseNumber(values.annualInsurance, "Versicherung pro Jahr", { min: 0 });
  const annualTax = parseNumber(values.annualTax, "Kfz-Steuer pro Jahr", { min: 0 });
  const annualMaintenance = parseNumber(values.annualMaintenance, "Wartung pro Jahr", { min: 0 });
  const annualMileage = parseNumber(values.annualMileage, "Fahrleistung pro Jahr", { min: 0 });
  const energyConsumption = parseNumber(values.energyConsumption, "Verbrauch", { min: 0 });
  const energyPrice = parseNumber(values.energyPrice, "Energiepreis", { min: 0 });
  const resaleValue = parseNumber(values.resaleValue, "Geschätzter Verkaufspreis", { min: 0 });

  if (downPayment > purchasePrice) {
    throw new Error("Die Anzahlung darf nicht höher als der Kaufpreis sein.");
  }
  if (resaleValue > purchasePrice) {
    throw new Error("Der geschätzte Verkaufspreis darf nicht höher als der Kaufpreis sein.");
  }
  if (!["petrol", "diesel", "electric"].includes(values.energyType)) {
    throw new Error("Bitte wähle eine gültige Antriebsart.");
  }
  if (annualMileage > 0 && (energyConsumption <= 0 || energyPrice <= 0)) {
    throw new Error("Für die Energiekosten müssen Verbrauch und Preis größer als null sein.");
  }

  const ownershipMonths = ownershipYears * 12;
  const financedAmount = purchasePrice - downPayment;
  const loan = calculateLoan(financedAmount, annualInterestRate, loanTermMonths, ownershipMonths);
  const completeLoan = calculateLoan(financedAmount, annualInterestRate, loanTermMonths, loanTermMonths);
  const annualEnergyCost = annualMileage / 100 * energyConsumption * energyPrice;
  const annualOperatingCost = annualInsurance + annualTax + annualMaintenance + annualEnergyCost;
  const operatingTotal = annualOperatingCost * ownershipYears;
  const depreciation = purchasePrice - resaleValue;
  const total = depreciation + loan.interestPaid + operatingTotal;

  if (![annualEnergyCost, operatingTotal, depreciation, total].every(Number.isFinite)) {
    throw new Error("Die eingegebenen Werte sind zu groß für eine sichere Berechnung.");
  }

  const monthlyOperatingCost = annualOperatingCost / 12;
  return {
    total,
    monthlyAverage: total / ownershipMonths,
    monthlyPayment: loan.payment,
    monthlyOperatingCost,
    monthlyBudgetDuringLoan: monthlyOperatingCost + loan.payment,
    downPayment,
    interestPaid: loan.interestPaid,
    totalLoanInterest: completeLoan.interestPaid,
    totalLoanRepayment: completeLoan.payment * completeLoan.monthsPaid,
    loanTermMonths,
    firstMonthPrincipal: financedAmount > 0
      ? Math.max(0, loan.payment - financedAmount * (annualInterestRate / 1200))
      : 0,
    operatingTotal,
    annualEnergyCost,
    monthlyEnergyCost: annualEnergyCost / 12,
    depreciation,
    resaleValue,
    remainingBalance: loan.remainingBalance,
    financedAmount,
    ownershipYears,
    ownershipMonths,
    monthsPaid: loan.monthsPaid
  };
}

function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatMetric(metric) {
  if (metric.value === null || metric.value === undefined) return "–";
  if (metric.format === "number") {
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(metric.value) + (metric.unit ? " " + metric.unit : "");
  }
  if (metric.format === "percent") {
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(metric.value) + "%";
  }
  if (metric.format === "unitPrice") {
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(metric.value) + " € / kWh";
  }
  return formatEuro(metric.value);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderResult(target, data) {
  const card = createElement("article", "result-card");
  const top = createElement("div", "result-top");
  const summary = createElement("div");
  summary.append(
    createElement("p", "result-kicker", data.kicker),
    createElement("p", "result-subtitle", data.subtitle)
  );
  top.append(summary, createElement("p", "result-total", formatEuro(data.total)));

  const metrics = createElement("div", "result-metrics");
  data.metrics.forEach((metric) => {
    const item = createElement("div", "metric");
    item.append(
      createElement("span", "metric-label", metric.label),
      createElement("strong", "metric-value", formatMetric(metric))
    );
    metrics.append(item);
  });

  const breakdown = createElement("div", "result-breakdown");
  breakdown.append(createElement("h3", "", "So setzt sich das Ergebnis zusammen"));
  data.breakdown.forEach((row) => {
    const item = createElement("div", "breakdown-row");
    item.append(createElement("span", "", row.label), createElement("strong", "", formatEuro(row.value)));
    breakdown.append(item);
  });

  card.append(top, metrics, breakdown);

  if (data.schedule && data.schedule.length) {
    const scheduleSection = createElement("section", "result-schedule");
    scheduleSection.append(createElement("h3", "", "Tilgungsplan pro Jahr"));
    const tableWrap = createElement("div", "result-schedule-wrap");
    const table = document.createElement("table");
    table.className = "result-schedule-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Zeitraum", "Gezahlt", "Davon Tilgung", "Davon Zinsen", "Restschuld"].forEach((label) => {
      const cell = createElement("th", "", label);
      cell.scope = "col";
      headerRow.append(cell);
    });
    head.append(headerRow);
    const body = document.createElement("tbody");
    data.schedule.forEach((row) => {
      const tableRow = document.createElement("tr");
      [row.period, formatEuro(row.paid), formatEuro(row.principal), formatEuro(row.interest), formatEuro(row.remainingBalance)].forEach((value, index) => {
        tableRow.append(createElement(index === 0 ? "th" : "td", "", value));
      });
      tableRow.firstElementChild.scope = "row";
      body.append(tableRow);
    });
    table.append(head, body);
    tableWrap.append(table);
    scheduleSection.append(tableWrap);
    card.append(scheduleSection);
  }

  card.append(createElement("p", "result-note", data.note));
  target.replaceChildren(card);
  target.hidden = false;
}

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showCalculation(form, result, error, calculate, toResult) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    result.hidden = true;
    result.replaceChildren();

    try {
      const answer = calculate(readForm(form));
      renderResult(result, toResult(answer));
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : "Die Werte konnten nicht berechnet werden.";
      error.hidden = false;
    }
  });
}

function configureEnergyFields(type, consumptionLabel, consumptionUnit, priceLabel, priceUnit, consumptionInput, priceInput, previousType) {
  const profiles = {
    petrol: { consumption: 6.5, price: 1.8, consumptionText: "Verbrauch (Liter / 100 km)", consumptionUnit: "L / 100 km", priceText: "Preis pro Liter", priceUnit: "€ / L" },
    diesel: { consumption: 5.5, price: 1.72, consumptionText: "Verbrauch (Liter / 100 km)", consumptionUnit: "L / 100 km", priceText: "Preis pro Liter", priceUnit: "€ / L" },
    electric: { consumption: 18, price: 0.35, consumptionText: "Verbrauch (kWh / 100 km)", consumptionUnit: "kWh / 100 km", priceText: "Strompreis pro kWh", priceUnit: "€ / kWh" }
  };
  const oldProfile = profiles[previousType];
  const newProfile = profiles[type];

  if (!oldProfile || !newProfile) return;
  if (Number(consumptionInput.value) === oldProfile.consumption) consumptionInput.value = String(newProfile.consumption);
  if (Number(priceInput.value) === oldProfile.price) priceInput.value = String(newProfile.price);
  consumptionLabel.textContent = newProfile.consumptionText;
  consumptionUnit.textContent = newProfile.consumptionUnit;
  priceLabel.textContent = newProfile.priceText;
  priceUnit.textContent = newProfile.priceUnit;
}

function init() {
  const generalPanel = document.getElementById("generalPanel");
  const carPanel = document.getElementById("carPanel");
  const generalForm = document.getElementById("generalForm");
  const electricityForm = document.getElementById("electricityForm");
  const creditForm = document.getElementById("creditForm");
  const generalTitle = document.getElementById("generalTitle");
  const generalDescription = document.getElementById("generalDescription");

  document.querySelectorAll(".category-button").forEach((button) => {
    button.addEventListener("click", () => {
      const isCar = button.dataset.panel === "auto";
      const isElectricity = button.dataset.label === "Strom";
      const isCredit = button.dataset.label === "Kredit";
      document.querySelectorAll(".category-button").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      generalPanel.hidden = isCar;
      carPanel.hidden = !isCar;
      generalForm.hidden = isElectricity || isCredit;
      electricityForm.hidden = !isElectricity;
      creditForm.hidden = !isCredit;

      if (!isCar) {
        const categories = {
          Strom: {
            title: "Stromkosten berechnen",
            description: "Verbrauch, Preis je Kilowattstunde und feste Gebühren übersichtlich zusammenrechnen."
          },
          Kredit: {
            title: "Kreditkosten berechnen",
            description: "Sieh Monatsrate, gesamte Zinsen und Tilgung über die vollständige Laufzeit."
          },
          Handy: {
            title: "Handykosten berechnen",
            description: "Einmalige und laufende Kosten über einen Zeitraum zusammenrechnen."
          },
          Internet: {
            title: "Internetkosten berechnen",
            description: "Einmalige und laufende Kosten über einen Zeitraum zusammenrechnen."
          },
          Abos: {
            title: "Abokosten berechnen",
            description: "Einmalige und laufende Kosten über einen Zeitraum zusammenrechnen."
          }
        };
        const category = categories[button.dataset.label] || {
          title: "Allgemeiner Kostenrechner",
          description: "Einmalige und laufende Kosten über einen Zeitraum zusammenrechnen."
        };
        generalTitle.textContent = category.title;
        generalDescription.textContent = category.description;
      }

      const panel = isCar ? carPanel : generalPanel;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  showCalculation(
    generalForm,
    document.getElementById("generalResult"),
    document.getElementById("generalError"),
    calculateGeneral,
    (answer) => ({
      kicker: "Gesamtkosten im Zeitraum",
      subtitle: "Für " + answer.duration + (answer.durationUnit === "years" ? (answer.duration === 1 ? " Jahr" : " Jahre") : (answer.duration === 1 ? " Monat" : " Monate")),
      total: answer.total,
      metrics: [
        { label: "Durchschnitt pro Monat", value: answer.monthlyAverage },
        { label: "Durchschnitt pro Jahr", value: answer.yearlyAverage },
        { label: "Abgezogener Rabatt", value: answer.discountAmount }
      ],
      breakdown: [
        { label: "Einmalige Kosten", value: answer.oneTime },
        { label: "Monatliche Kosten im Zeitraum", value: answer.monthlyTotal },
        { label: "Jährliche Kosten im Zeitraum", value: answer.annualTotal },
        { label: "Zusatzkosten", value: answer.extra },
        { label: "Rabatt auf einmalige und Zusatzkosten", value: -answer.discountAmount }
      ],
      note: "Leere Betragsfelder werden als 0 € gerechnet. Der Rabatt gilt nur für einmalige Kosten und Zusatzkosten."
    })
  );

  showCalculation(
    electricityForm,
    document.getElementById("electricityResult"),
    document.getElementById("electricityError"),
    calculateElectricity,
    (answer) => ({
      kicker: "Stromkosten im Zeitraum",
      subtitle: "Für " + answer.durationYears + (answer.durationYears === 1 ? " Jahr" : " Jahre"),
      total: answer.total,
      metrics: [
        { label: "Durchschnitt pro Monat", value: answer.monthlyAverage },
        { label: "Kosten pro Jahr", value: answer.yearlyAverage },
        { label: "Verbrauchskosten pro Jahr", value: answer.annualEnergyCost },
        { label: "Effektiver Preis inklusive Gebühren", value: answer.effectivePricePerKwh, format: "unitPrice" }
      ],
      breakdown: [
        { label: "Verbrauchskosten im Zeitraum", value: answer.annualEnergyCost * answer.durationYears },
        { label: "Grundpreis im Zeitraum", value: answer.annualBaseFee * answer.durationYears },
        { label: "Zähler- und Messstellengebühr im Zeitraum", value: answer.annualMeterFee * answer.durationYears },
        { label: "Weitere feste Monatsgebühren", value: answer.annualOtherMonthlyFees * answer.durationYears },
        { label: "Weitere Jahresgebühren", value: answer.annualOtherFees * answer.durationYears },
        { label: "Einmalige Gebühren", value: answer.oneTimeFees }
      ],
      note: "Beispielwerte bitte mit deinem Tarif und der letzten Jahresabrechnung abgleichen. Der effektive Preis je kWh verteilt auch feste Gebühren auf deinen Verbrauch."
    })
  );

  showCalculation(
    creditForm,
    document.getElementById("creditResult"),
    document.getElementById("creditError"),
    calculateCredit,
    (answer) => ({
      kicker: "Gesamt zurückzuzahlen",
      subtitle: answer.termMonths + " Monate bei " + new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(answer.annualInterestRate) + "% Sollzins pro Jahr",
      total: answer.totalPaid,
      metrics: [
        { label: "Monatliche Rate", value: answer.monthlyPayment },
        { label: "Zinsen insgesamt", value: answer.totalInterest },
        { label: "Laufzeit", value: answer.termMonths, format: "number", unit: "Monate" },
        { label: "Tilgung in der ersten Rate", value: answer.firstMonthPrincipal }
      ],
      breakdown: [
        { label: "Kreditsumme", value: answer.principal },
        { label: "Zinsen insgesamt", value: answer.totalInterest },
        { label: "Davon im ersten Monat Zinsen", value: answer.firstMonthInterest },
        { label: "Davon im ersten Monat Tilgung", value: answer.firstMonthPrincipal },
        { label: "Getilgter Kreditbetrag über die Laufzeit", value: answer.principal }
      ],
      schedule: answer.schedule,
      note: "Vereinfachte Annuitätenrechnung mit gleichbleibender Monatsrate. Zusätzliche Bankgebühren, abweichende Rundungen und Sondertilgungen sind nicht enthalten."
    })
  );

  showCalculation(
    document.getElementById("carForm"),
    document.getElementById("carResult"),
    document.getElementById("carError"),
    calculateCar,
    (answer) => ({
      kicker: "Geschätzte Gesamtkosten",
      subtitle: "Über " + answer.ownershipYears + (answer.ownershipYears === 1 ? " Jahr" : " Jahre") + " Besitzzeit",
      total: answer.total,
      metrics: [
        { label: "Kosten im Schnitt pro Monat", value: answer.monthlyAverage },
        { label: "Kreditrate pro Monat", value: answer.monthlyPayment },
        { label: "Laufende Kosten pro Monat", value: answer.monthlyOperatingCost },
        { label: "Kreditsumme", value: answer.financedAmount },
        { label: "Kreditlaufzeit", value: answer.loanTermMonths, format: "number", unit: "Monate" },
        { label: "Zinsen bei kompletter Kreditlaufzeit", value: answer.totalLoanInterest },
        { label: "Tilgung in der ersten Monatsrate", value: answer.firstMonthPrincipal },
        { label: "Anzahlung zu Beginn", value: answer.downPayment }
      ],
      breakdown: [
        { label: "Wertverlust (Kaufpreis abzüglich Verkaufspreis)", value: answer.depreciation },
        { label: "Finanzierungszinsen während der Besitzzeit", value: answer.interestPaid },
        { label: "Gesamtrückzahlung über die Kreditlaufzeit", value: answer.totalLoanRepayment },
        { label: "Laufende Kosten über die Besitzzeit", value: answer.operatingTotal },
        { label: "davon Kraftstoff oder Strom pro Monat", value: answer.monthlyEnergyCost },
        { label: "Geldbedarf pro Monat während des Kredits", value: answer.monthlyBudgetDuringLoan },
        { label: "Geschätzte Restschuld am Ende der Besitzzeit", value: answer.remainingBalance }
      ],
      note: "Die Autogesamtkosten zählen Wertverlust, Zinsen bis zum Ende der Besitzzeit und laufende Kosten. Zusätzlich siehst du die Zinsen und Rückzahlung über die komplette Kreditlaufzeit. Anzahlung und Tilgung werden nicht doppelt als Kosten gezählt."
    })
  );

  const energyType = document.getElementById("carEnergyType");
  const consumptionLabel = document.getElementById("carConsumptionLabel");
  const consumptionUnit = document.getElementById("carConsumptionUnit");
  const priceLabel = document.getElementById("carEnergyPriceLabel");
  const priceUnit = document.getElementById("carEnergyPriceUnit");
  const consumptionInput = document.getElementById("carConsumption");
  const priceInput = document.getElementById("carEnergyPrice");
  let previousType = energyType.value;

  energyType.addEventListener("change", () => {
    configureEnergyFields(
      energyType.value,
      consumptionLabel,
      consumptionUnit,
      priceLabel,
      priceUnit,
      consumptionInput,
      priceInput,
      previousType
    );
    previousType = energyType.value;
  });

  document.getElementById("currentYear").textContent = String(new Date().getFullYear());
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateGeneral, calculateElectricity, calculateCredit, calculateCar };
}
