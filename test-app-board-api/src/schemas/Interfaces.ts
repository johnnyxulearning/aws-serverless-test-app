export interface IMessage {
  content: string;
  active: boolean;
  PostedAt: string;
}

export interface IMessageBoard {
  boardName: string;
  category: string;
  owner: string;
  createdAt: string;
}
