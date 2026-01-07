import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import supabase from '../config/supabase.js';
import { success, error, paginated } from '../utils/response.js';

const router = Router();

// Get user's notifications
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const unreadOnly = req.query.unread === 'true';
    const offset = (page - 1) * perPage;

    let countQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    let dataQuery = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (unreadOnly) {
      countQuery = countQuery.eq('is_read', false);
      dataQuery = dataQuery.eq('is_read', false);
    }

    const { count } = await countQuery;
    const { data, error: fetchError } = await dataQuery;

    if (fetchError) throw fetchError;

    res.json(paginated(data || [], page, perPage, count || 0));
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json(error('FETCH_ERROR', 'Failed to fetch notifications'));
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { count, error: fetchError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (fetchError) throw fetchError;

    res.json(success({ count: count || 0 }));
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json(error('FETCH_ERROR', 'Failed to fetch unread count'));
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { data, error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(success(data));
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json(error('UPDATE_ERROR', 'Failed to update notification'));
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (updateError) throw updateError;

    res.json(success({ message: 'All notifications marked as read' }));
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json(error('UPDATE_ERROR', 'Failed to update notifications'));
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    res.json(success({ deleted: true }));
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json(error('DELETE_ERROR', 'Failed to delete notification'));
  }
});

// Delete all notifications
router.delete('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    res.json(success({ message: 'All notifications deleted' }));
  } catch (err) {
    console.error('Error deleting notifications:', err);
    res.status(500).json(error('DELETE_ERROR', 'Failed to delete notifications'));
  }
});

export default router;
