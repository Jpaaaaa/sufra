type SufraPricingProps = {
  onChoosePlan: (plan: string) => void;
};

export default function SufraPricing({ onChoosePlan }: SufraPricingProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {['Lite', 'Pro', 'Full'].map((plan) => (
        <div
          key={plan}
          className="bg-card rounded-xl border border-border p-6 shadow-lg"
        >
          <h3 className="text-xl font-bold text-foreground mb-2">{plan}</h3>
          <button
            type="button"
            onClick={() => onChoosePlan(plan)}
            className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
          >
            Choose {plan}
          </button>
        </div>
      ))}
    </div>
  );
}
