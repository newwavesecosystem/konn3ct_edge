import { logger } from '../logger';

const { ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY } = process.env;

/**
 * Odoo Integration Service
 * This abstraction layer isolates the Odoo API access behind reusable service methods.
 * Currently uses XML-RPC (Odoo 18). Will retain XML-RPC or transition to JSON-RPC/External API
 * in Odoo 19 seamlessly without refactoring the business logic.
 */
class OdooService {
  private async jsonRpcCall(service: string, method: string, args: any[]) {
    if (!ODOO_URL) throw new Error("ODOO_URL is missing in environment");
    
    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: service,
        method: method,
        args: args
      }
    };

    const response = await fetch(`${ODOO_URL.replace(/\/$/, '')}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = (await response.json()) as any;
    if (data.error) {
      throw new Error(`Odoo API Error: ${JSON.stringify(data.error)}`);
    }
    return data.result;
  }

  public async authenticate(): Promise<number> {
    if (!ODOO_DB || !ODOO_USER || !ODOO_API_KEY) {
      throw new Error("Missing Odoo credentials in environment variables");
    }
    const uid = await this.jsonRpcCall('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]);
    if (!uid) throw new Error("Odoo authentication failed");
    return uid;
  }

  public async updateTask(taskId: number, payload: any): Promise<boolean> {
    const uid = await this.authenticate();
    return await this.jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'write',
      [[taskId], payload]
    ]);
  }

  public async createTask(payload: any): Promise<number> {
    const uid = await this.authenticate();
    return await this.jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'create',
      [payload]
    ]);
  }

  public async getNextSequence(code: string): Promise<string | null> {
    const uid = await this.authenticate();
    try {
      const result = await this.jsonRpcCall('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'ir.sequence', 'next_by_code',
        [code]
      ]);
      return result || null;
    } catch (e) {
      logger.warn(`Failed to fetch sequence for ${code}. It may not exist in Odoo yet.`);
      return null;
    }
  }

  public async createSocialDraft(payload: any): Promise<number> {
    const uid = await this.authenticate();
    return await this.jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'social.post', 'create',
      [payload]
    ]);
  }
}

export const odooService = new OdooService();
