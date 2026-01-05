import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding credit packages...');

  const packages = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 5,
      priceInCents: 1500,
      stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_placeholder',
      displayOrder: 1,
      bonusCredits: 0,
      badgeText: null,
    },
    {
      id: 'creator',
      name: 'Creator',
      credits: 25,
      priceInCents: 5900,
      stripePriceId: process.env.STRIPE_PRICE_CREATOR || 'price_creator_placeholder',
      displayOrder: 2,
      bonusCredits: 0,
      badgeText: 'Most Popular',
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 100,
      priceInCents: 19900,
      stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
      displayOrder: 3,
      bonusCredits: 0,
      badgeText: 'Best Value',
    },
    {
      id: 'agency',
      name: 'Agency',
      credits: 500,
      priceInCents: 74900,
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
