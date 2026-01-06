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
      stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_placeholder',
      displayOrder: 1,
      bonusCredits: 0,
      badgeText: null,
    },
    {
      id: 'creator',
      name: 'Creator',
      credits: 25,
      priceInCents: 5900, // $59.00 ($2.36/video)
      stripePriceId: process.env.STRIPE_PRICE_CREATOR || 'price_creator_placeholder',
      displayOrder: 2,
      bonusCredits: 0,
      badgeText: 'Most Popular',
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 100,
      priceInCents: 19900, // $199.00 ($1.99/video)
      stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
      displayOrder: 3,
      bonusCredits: 0,
      badgeText: 'Best Value',
    },
    {
      id: 'agency',
      name: 'Agency',
      credits: 500,
      priceInCents: 74900, // $749.00 ($1.50/video)
      stripePriceId: process.env.STRIPE_PRICE_AGENCY || 'price_agency_placeholder',
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
      monthlyStripePriceId: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'price_basic_monthly_placeholder',
      monthlyCredits: 10,
      yearlyPriceInCents: 19000, // $190/year (save ~17%)
      yearlyStripePriceId: process.env.STRIPE_PRICE_BASIC_YEARLY || 'price_basic_yearly_placeholder',
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
      monthlyStripePriceId: process.env.STRIPE_PRICE_STANDARD_MONTHLY || 'price_standard_monthly_placeholder',
      monthlyCredits: 30,
      yearlyPriceInCents: 49000, // $490/year (save ~17%)
      yearlyStripePriceId: process.env.STRIPE_PRICE_STANDARD_YEARLY || 'price_standard_yearly_placeholder',
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
      monthlyStripePriceId: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly_placeholder',
      monthlyCredits: 75,
      yearlyPriceInCents: 99000, // $990/year (save ~17%)
      yearlyStripePriceId: process.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly_placeholder',
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
