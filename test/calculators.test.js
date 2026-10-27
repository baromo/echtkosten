const assert = require("node:assert/strict");
const { calculateGeneral, calculateElectricity, calculateCredit, calculateCar } = require("../script.js");

function test(name, callback) {
  callback();
  console.log("✓ " + name);
}

test("allgemeiner Rechner summiert Laufzeitkosten und Rabatt korrekt", () => {
  const result = calculateGeneral({
    oneTime: "100", monthly: "10", annual: "120", extra: "40",
    discount: "10", duration: "12", durationUnit: "months"
  });
  assert.equal(result.total, 366);
  assert.equal(result.monthlyAverage, 30.5);
  assert.equal(result.discountAmount, 14);
});

test("Jahreslaufzeit wird in Monate umgerechnet", () => {
  const result = calculateGeneral({
    oneTime: "0", monthly: "10", annual: "0", extra: "0",
    discount: "0", duration: "2", durationUnit: "years"
  });
  assert.equal(result.months, 24);
  assert.equal(result.total, 240);
});

test("Laufzeit null und Rabatt über 100 Prozent werden abgewiesen", () => {
  const values = { oneTime: 0, monthly: 1, annual: 0, extra: 0, discount: 0, duration: 0, durationUnit: "months" };
  assert.throws(() => calculateGeneral(values), /Laufzeit/);
  assert.throws(() => calculateGeneral({ ...values, duration: 1, discount: 101 }), /Rabatt/);
});

test("Stromkosten enthalten Verbrauch, Grundpreis, Zähler und weitere Gebühren", () => {
  const result = calculateElectricity({
    annualKwh: 3500, pricePerKwh: 0.35, monthlyBaseFee: 12,
    monthlyMeterFee: 3, monthlyOtherFees: 5, annualOtherFees: 24,
    oneTimeFees: 50, durationYears: 2
  });
  assert.equal(result.annualEnergyCost, 1225);
  assert.equal(result.annualBaseFee, 144);
  assert.equal(result.annualMeterFee, 36);
  assert.equal(result.total, 3028);
  assert.equal(result.monthlyAverage, 3028 / 24);
  assert.equal(result.effectivePricePerKwh, 3028 / 7000);
});

test("Stromkosten lassen null Verbrauch zu und zeigen dann keinen kWh-Preis", () => {
  const result = calculateElectricity({
    annualKwh: 0, pricePerKwh: 0.35, monthlyBaseFee: 12,
    monthlyMeterFee: 0, monthlyOtherFees: 0, annualOtherFees: 0,
    oneTimeFees: 0, durationYears: 1
  });
  assert.equal(result.total, 144);
  assert.equal(result.effectivePricePerKwh, null);
});

test("Kreditrechner berechnet Rate, Gesamtzinsen und jährliche Tilgung", () => {
  const result = calculateCredit({ principal: 10000, annualInterestRate: 12, termMonths: 12 });
  assert.ok(result.monthlyPayment > 0);
  assert.ok(result.totalInterest > 0);
  assert.ok(Math.abs(result.totalPaid - (result.principal + result.totalInterest)) < 1e-8);
  assert.ok(result.firstMonthPrincipal > 0);
  assert.ok(result.firstMonthPrincipal < result.monthlyPayment);
  assert.equal(result.schedule.length, 1);
  assert.equal(result.schedule[0].remainingBalance, 0);
  assert.ok(Math.abs(result.schedule[0].principal - result.principal) < 1e-8);
});

test("zinsfreier Kredit wird ohne Zinskosten vollständig getilgt", () => {
  const result = calculateCredit({ principal: 1200, annualInterestRate: 0, termMonths: 12 });
  assert.equal(result.monthlyPayment, 100);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPaid, 1200);
  assert.equal(result.firstMonthPrincipal, 100);
  assert.equal(result.remainingBalance, 0);
});

test("Kreditrechner weist ungültige Laufzeit und Zinssätze ab", () => {
  assert.throws(() => calculateCredit({ principal: 1000, annualInterestRate: 5, termMonths: 0 }), /Laufzeit/);
  assert.throws(() => calculateCredit({ principal: 1000, annualInterestRate: 101, termMonths: 12 }), /Sollzins/);
});

test("Autorechner zählt Anzahlung und Tilgung nicht doppelt", () => {
  const result = calculateCar({
    purchasePrice: 25000, downPayment: 5000, annualInterestRate: 0,
    loanTermMonths: 60, ownershipYears: 5, annualInsurance: 720,
    annualTax: 180, annualMaintenance: 600, annualMileage: 12000,
    energyType: "petrol", energyConsumption: 6.5, energyPrice: 1.8, resaleValue: 10000
  });
  assert.equal(result.depreciation, 15000);
  assert.equal(result.annualEnergyCost, 1404);
  assert.equal(result.operatingTotal, 14520);
  assert.equal(result.total, 29520);
  assert.equal(result.monthlyPayment, 20000 / 60);
});

test("Autorechner berücksichtigt Zinsen im Besitzzeitraum", () => {
  const result = calculateCar({
    purchasePrice: 10000, downPayment: 0, annualInterestRate: 12,
    loanTermMonths: 24, ownershipYears: 1, annualInsurance: 0,
    annualTax: 0, annualMaintenance: 0, annualMileage: 0,
    energyType: "petrol", energyConsumption: 0, energyPrice: 0, resaleValue: 0
  });
  assert.equal(result.monthsPaid, 12);
  assert.ok(result.interestPaid > 0);
  assert.ok(result.remainingBalance > 0);
  assert.ok(result.remainingBalance < 10000);
});

test("Elektroverbrauch wird als kWh pro 100 km gerechnet", () => {
  const result = calculateCar({
    purchasePrice: 20000, downPayment: 20000, annualInterestRate: 0,
    loanTermMonths: 60, ownershipYears: 1, annualInsurance: 0,
    annualTax: 0, annualMaintenance: 0, annualMileage: 10000,
    energyType: "electric", energyConsumption: 18, energyPrice: 0.35, resaleValue: 15000
  });
  assert.equal(result.annualEnergyCost, 630);
});

test("Anzahlung und Verkaufspreis werden auf den Kaufpreis geprüft", () => {
  const values = {
    purchasePrice: 10000, downPayment: 0, annualInterestRate: 0,
    loanTermMonths: 60, ownershipYears: 1, annualInsurance: 0,
    annualTax: 0, annualMaintenance: 0, annualMileage: 0,
    energyType: "petrol", energyConsumption: 0, energyPrice: 0, resaleValue: 0
  };
  assert.throws(() => calculateCar({ ...values, downPayment: 10001 }), /Anzahlung/);
  assert.throws(() => calculateCar({ ...values, resaleValue: 10001 }), /Verkaufspreis/);
});

console.log("Alle Rechnerprüfungen bestanden.");
