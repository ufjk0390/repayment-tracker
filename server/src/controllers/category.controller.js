import prisma from '../lib/prisma.js';

export async function list(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { isSystem: true },
          { userId: req.user.id },
        ],
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });

    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'Only users can create custom categories',
        },
      });
    }

    const { name, type } = req.body;

    if (!name || !type || !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name and type (INCOME/EXPENSE) are required',
        },
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        type,
        isSystem: false,
        userId: req.user.id,
      },
    });

    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      return res.status(404).json({
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found',
        },
      });
    }

    if (category.isSystem) {
      return res.status(400).json({
        error: {
          code: 'CATEGORY_SYSTEM_IMMUTABLE',
          message: 'System categories cannot be modified',
        },
      });
    }

    if (category.userId !== req.user.id) {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'You can only modify your own categories',
        },
      });
    }

    const { name, sortOrder } = req.body;
    const data = {};
    if (name) data.name = name;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      return res.status(404).json({
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found',
        },
      });
    }

    if (category.isSystem) {
      return res.status(400).json({
        error: {
          code: 'CATEGORY_SYSTEM_IMMUTABLE',
          message: 'System categories cannot be deleted',
        },
      });
    }

    if (category.userId !== req.user.id) {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'You can only delete your own categories',
        },
      });
    }

    // Check if any transactions reference this category
    const txCount = await prisma.transaction.count({
      where: { categoryId: id },
    });

    if (txCount > 0) {
      return res.status(400).json({
        error: {
          code: 'CATEGORY_IN_USE',
          message: `Cannot delete category: ${txCount} transaction(s) reference it`,
        },
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ data: { message: 'Category deleted successfully' } });
  } catch (err) {
    next(err);
  }
}
