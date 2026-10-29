import {
  Armchair, Backpack, BedDouble, BookOpen, Brush, Clock, Coffee, CupSoda, Flower2, Laptop, Smartphone, Soup, Tv, Utensils,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

const map: Record<string, ComponentType<LucideProps>> = {
  cup: Coffee, bottle: CupSoda, chair: Armchair, book: BookOpen, toothbrush: Brush, bowl: Soup, spoon: Utensils,
  backpack: Backpack, laptop: Laptop, phone: Smartphone, remote: Tv, plant: Flower2, bed: BedDouble, clock: Clock,
};

export function ObjectIcon({ name, ...rest }: { name: string } & LucideProps) {
  const Icon = map[name] ?? Coffee;
  return <Icon {...rest} />;
}
