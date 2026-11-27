import type { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { askGemini } from "./chat.service";

const MAX_MESSAGE_LENGTH = 500;

export async function chat(req: Request, res: Response) {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    throw new AppError("Escribí un mensaje", 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres`, 400);
  }

  const reply = await askGemini(message);
  res.status(200).json({ reply });
}