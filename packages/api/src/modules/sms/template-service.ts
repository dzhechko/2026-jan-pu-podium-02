import type { PrismaClient } from '@prisma/client';

const DEFAULT_SMS_TEMPLATES: Record<number, string> = {
  0: '{company} просит оставить отзыв: {link}\nОтписка: {optout}',
  1: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  2: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  3: '{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}',
  4: '{company}: Последнее напоминание — оставьте отзыв: {link}\nОтписка: {optout}',
};

const DEFAULT_MESSENGER_TEMPLATES: Record<number, string> = {
  0: '\u{1F44B} *{company}* приглашает оставить отзыв!\n\n\u{1F517} {link}\n\n_Отписка: {optout}_',
  1: '\u{1F514} *{company}*: напоминаем — оставьте отзыв!\n\n\u{1F517} {link}\n\n_Отписка: {optout}_',
  2: '\u{1F514} *{company}*: напоминаем — оставьте отзыв!\n\n\u{1F517} {link}\n\n_Отписка: {optout}_',
  3: '\u{1F514} *{company}*: напоминаем — оставьте отзыв!\n\n\u{1F517} {link}\n\n_Отписка: {optout}_',
  4: '\u{23F0} *{company}*: последнее напоминание!\n\n\u{1F517} {link}\n\n_Отписка: {optout}_',
};

/** @deprecated Use DEFAULT_SMS_TEMPLATES instead */
const DEFAULT_TEMPLATES = DEFAULT_SMS_TEMPLATES;

const REQUIRED_PLACEHOLDERS = ['{link}', '{optout}'];

export class SmsTemplateService {
  constructor(private prisma: PrismaClient) {}

  async upsertTemplate(adminId: string, reminderNumber: number, messageTemplate: string, channel = 'sms') {
    // Validate placeholders
    for (const placeholder of REQUIRED_PLACEHOLDERS) {
      if (!messageTemplate.includes(placeholder)) {
        throw new Error(`Шаблон должен содержать ${placeholder}`);
      }
    }

    const existing = await this.prisma.smsTemplate.findFirst({
      where: { adminId, reminderNumber, channel },
    });

    if (existing) {
      return this.prisma.smsTemplate.update({
        where: { id: existing.id },
        data: { messageTemplate },
      });
    }

    return this.prisma.smsTemplate.create({
      data: { adminId, reminderNumber, messageTemplate, channel },
    });
  }

  async listTemplates(adminId: string) {
    const templates = await this.prisma.smsTemplate.findMany({
      where: { adminId },
      orderBy: [{ channel: 'asc' }, { reminderNumber: 'asc' }],
    });

    return {
      data: templates.map((t) => ({
        id: t.id,
        reminder_number: t.reminderNumber,
        channel: t.channel,
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
    channel = 'sms',
  ): Promise<string> {
    const template = await this.prisma.smsTemplate.findFirst({
      where: { adminId, reminderNumber, channel },
    });

    const defaults = this.getDefaultTemplates(channel);
    const text = template?.messageTemplate ?? defaults[reminderNumber] ?? defaults[1];

    return text
      .replace('{company}', company)
      .replace('{link}', link)
      .replace('{optout}', optout);
  }

  private getDefaultTemplates(channel: string): Record<number, string> {
    if (channel === 'telegram' || channel === 'max') {
      return DEFAULT_MESSENGER_TEMPLATES;
    }
    return DEFAULT_SMS_TEMPLATES;
  }
}
