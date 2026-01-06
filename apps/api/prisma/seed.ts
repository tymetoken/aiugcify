import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding credit packages...');

  // One-time credit packages - Sora 2 Standard quality ($0.125/video API cost)
  const packages = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 5,
      priceInCents: 1500, // $15.00 ($3.00/video)
      stripePriceId: 'price_1SmfiFCrXz9HvykqMtMlsJDH',
      displayOrder: 1,
      bonusCredits: 0,
      badgeText: null,
    },
    {
      id: 'creator',
      name: 'Creator',
      credits: 25,
      priceInCents: 5900, // $59.00 ($2.36/video)
      stripePriceId: 'price_1SmficCrXz9HvykqqUoLsy02',
      displayOrder: 2,
      bonusCredits: 0,
      badgeText: 'Most Popular',
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 100,
      priceInCents: 19900, // $199.00 ($1.99/video)
      stripePriceId: 'price_1Smfj0CrXz9Hvykq30rE5KRp',
      displayOrder: 3,
      bonusCredits: 0,
      badgeText: 'Best Value',
    },
    {
      id: 'agency',
      name: 'Agency',
      credits: 500,
      priceInCents: 74900, // $749.00 ($1.50/video)
      stripePriceId: 'price_1SmfjJCrXz9HvykqhXIUAhsv',
      displayOrder: 4,
      bonusCredits: 0,
      badgeText: null,
    },
  ];

  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }

  console.log('Credit packages seeded!');

  // Subscription plans
  console.log('Seeding subscription plans...');

  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Perfect for getting started with UGC videos',
      monthlyPriceInCents: 1900, // $19/month
      monthlyStripePriceId: 'price_1SmgtiCrXz9HvykqDLyRhECZ',
      monthlyCredits: 10,
      yearlyPriceInCents: 19200, // $192/year (save ~16%)
      yearlyStripePriceId: 'price_1Smgv2CrXz9HvykqOTqaC9OJ',
      yearlyCredits: 120, // 10 credits/month * 12
      yearlyBonusCredits: 20, // +20 bonus credits for yearly
      features: ['10 videos per month', 'HD quality exports', 'Email support'],
      displayOrder: 1,
      badgeText: null,
    },
    {
      id: 'standard',
      name: 'Standard',
      description: 'Best for growing creators and small businesses',
      monthlyPriceInCents: 4900, // $49/month
      monthlyStripePriceId: 'price_1SmgvOCrXz9HvykqRh5cJsc6',
      monthlyCredits: 30,
      yearlyPriceInCents: 49200, // $492/year (save ~16%)
      yearlyStripePriceId: 'price_1SmgvfCrXz9Hvykq78VHPp5U',
      yearlyCredits: 360, // 30 credits/month * 12
      yearlyBonusCredits: 60, // +60 bonus credits for yearly
      features: ['30 videos per month', '4K quality exports', 'Priority support', 'Custom templates'],
      displayOrder: 2,
      badgeText: 'Most Popular',
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'For power users, agencies, and enterprises',
      monthlyPriceInCents: 9900, // $99/month
      monthlyStripePriceId: 'price_1Smgw5CrXz9HvykqgMiY56yL',
      monthlyCredits: 75,
      yearlyPriceInCents: 99600, // $996/year (save ~16%)
      yearlyStripePriceId: 'price_1SmgwRCrXz9HvykqALibdeJe',
      yearlyCredits: 900, // 75 credits/month * 12
      yearlyBonusCredits: 150, // +150 bonus credits for yearly
      features: ['75 videos per month', '4K quality exports', 'Dedicated support', 'API access', 'White-label options'],
      displayOrder: 3,
      badgeText: 'Best Value',
    },
  ];

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log('Subscription plans seeded!');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
