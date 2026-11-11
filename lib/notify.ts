import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, string | number | boolean | null>;
  url?: string;
};

/** Create an in-app notification and fire a web push (best effort). */
export async function notify(input: NotifyInput): Promise<void> {
  const { url, ...rest } = input;
  await prisma.notification.create({
    data: {
      userId: rest.userId,
      type: rest.type,
      title: rest.title,
      message: rest.message,
      data: rest.data,
    },
  });
  void sendPush(input.userId, { title: input.title, body: input.message, url: url ?? '/activity' });
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await prisma.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      message: i.message,
      data: i.data,
    })),
  });
  for (const i of inputs) {
    void sendPush(i.userId, { title: i.title, body: i.message, url: i.url ?? '/activity' });
  }
}
