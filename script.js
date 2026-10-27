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
      createElement("strong", "metric-value", formatEuro(metric.value))
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

  card.append(top, metrics, breakdown, createElement("p", "result-note", data.note));
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
  const generalTitle = document.getElementById("generalTitle");
  const generalDescription = document.getElementById("generalDescription");

  document.querySelectorAll(".category-button").forEach((button) => {
    button.addEventListener("click", () => {
      const isCar = button.dataset.panel === "auto";
      document.querySelectorAll(".category-button").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      generalPanel.hidden = isCar;
      carPanel.hidden = !isCar;

      if (!isCar) {
        const labels = {
          Strom: "Stromkosten berechnen",
          Handy: "Handykosten berechnen",
          Internet: "Internetkosten berechnen",
          Abos: "Abokosten berechnen",
          Kredit: "Kreditkosten berechnen"
        };
        generalTitle.textContent = labels[button.dataset.label] || "Allgemeiner Kostenrechner";
        generalDescription.textContent = "Einmalige und laufende Kosten über einen Zeitraum zusammenrechnen.";
      }

      const panel = isCar ? carPanel : generalPanel;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  showCalculation(
    document.getElementById("generalForm"),
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
        { label: "Anzahlung zu Beginn", value: answer.downPayment }
      ],
      breakdown: [
        { label: "Wertverlust (Kaufpreis abzüglich Verkaufspreis)", value: answer.depreciation },
        { label: "Finanzierungszinsen während der Besitzzeit", value: answer.interestPaid },
        { label: "Laufende Kosten über die Besitzzeit", value: answer.operatingTotal },
        { label: "davon Kraftstoff oder Strom pro Monat", value: answer.monthlyEnergyCost },
        { label: "Geldbedarf pro Monat während des Kredits", value: answer.monthlyBudgetDuringLoan },
        { label: "Geschätzte Restschuld am Ende der Besitzzeit", value: answer.remainingBalance }
      ],
      note: "Die Gesamtkosten bestehen aus Wertverlust, Finanzierungszinsen und laufenden Kosten. Anzahlung und Tilgung werden nicht zusätzlich gezählt, damit der Kaufpreis nicht doppelt eingeht. Die Restschuld ist ein Schätzwert bei Verkauf am Ende der Besitzzeit."
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
  module.exports = { calculateGeneral, calculateCar };
}
