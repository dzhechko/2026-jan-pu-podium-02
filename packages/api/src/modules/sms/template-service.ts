import type { PrismaClient } from '@prisma/client';

const DEFAULT_TEMPLATES: Record<number, string> = {
  0: '{company} просит оставить отзыв: {link}\nОтписка: {optout}',
  1: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  2: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  3: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  4: '{company}: Последнее напоминание — оставьте отзыв: {link}\nОтписка: {optout}',
};

const REQUIRED_PLACEHOLDERS = ['{link}', '{optout}'];

export class SmsTemplateService {
  constructor(private prisma: PrismaClient) {}

  async upsertTemplate(adminId: string, reminderNumber: number, messageTemplate: string) {
    // Validate placeholders
    for (const placeholder of REQUIRED_PLACEHOLDERS) {
      if (!messageTemplate.includes(placeholder)) {
        throw new Error(`Шаблон должен содержать ${placeholder}`);
      }
    }

    const existing = await this.prisma.smsTemplate.findFirst({
      where: { adminId, reminderNumber },
    });

    if (existing) {
      return this.prisma.smsTemplate.update({
        where: { id: existing.id },
        data: { messageTemplate },
      });
    }

    return this.prisma.smsTemplate.create({
      data: { adminId, reminderNumber, messageTemplate },
    });
  }

  async listTemplates(adminId: string) {
    const templates = await this.prisma.smsTemplate.findMany({
      where: { adminId },
      orderBy: { reminderNumber: 'asc' },
    });

    return {
      data: templates.map((t) => ({
        id: t.id,
        reminder_number: t.reminderNumber,
        message_template: t.messageTemplate,
        created_at: t.createdAt.toISOString(),
      })),
      defaults: DEFAULT_TEMPLATES,
    };
  }

  async deleteTemplate(adminId: string, templateId: string) {
    const template = await this.prisma.smsTemplate.findFirst({
      where: { id: templateId, adminId },
    });
    if (!template) {
      throw new Error('Template not found');
    }
    await this.prisma.smsTemplate.delete({ where: { id: templateId } });
  }

  async getMessage(
    adminId: string,
    reminderNumber: number,
    company: string,
    link: string,
    optout: string,
  ): Promise<string> {
    const template = await this.prisma.smsTemplate.findFirst({
      where: { adminId, reminderNumber },
    });

    const text = template?.messageTemplate ?? DEFAULT_TEMPLATES[reminderNumber] ?? DEFAULT_TEMPLATES[1];

    return text
      .replace('{company}', company)
      .replace('{link}', link)
      .replace('{optout}', optout);
  }
}
