// The one shape every successful response uses:
// { success: true, message, data, meta? }
export class ApiResponse {
  constructor(data = null, message = 'OK', meta) {
    this.success = true;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }
}
