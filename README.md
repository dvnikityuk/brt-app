# 📊 BRT — Заказ расходных материалов

[![React](https://img.shields.io/badge/React-19.2.3-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.2.4-646cff?logo=vite)](https://vite.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Система прогнозирования спроса и планирования запасов на основе ABC-XYZ анализа.

## 🎯 Возможности

| Функция | Описание |
|---------|----------|
| **ABC-XYZ классификация** | Автоматическое определение ключевых позиций |
| **Прогнозирование спроса** | Методы Холта и скользящего среднего |
| **Нормативы склада** | Расчёт Min, Max, Target, ROP, страхового запаса |
| **Планирование заказов** | С учётом кратности упаковке и каникул |
| **Анализ выбросов** | IQR, Z-Score, MAD методы очистки данных |
| **Сезонность** | Визуальный редактор коэффициентов |
| **Экспорт в Excel** | 5 листов с полным планом |
| **Single-file сборка** | Всё приложение в одном HTML-файле |

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build