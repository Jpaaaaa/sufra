import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { PrintersService, PrinterSettings } from './printers.service';

class SavePrinterSettingDto {
  kitchen_id!: number | null;
  printer_ip!: string | null; // Printer IP address (e.g., "192.168.1.50")
  printer_port?: number; // Printer port (default: 9100)
  printer_type?: 'kitchen' | 'customer'; // Optional - will be auto-determined from kitchen_id
}

@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get('available')
  getAvailablePrinters() {
    return this.printersService.getAvailablePrinters();
  }

  @Get('settings')
  getAllSettings(): Promise<PrinterSettings[]> {
    return this.printersService.getAllSettings();
  }

  @Post('settings')
  saveSetting(@Body() dto: SavePrinterSettingDto): Promise<PrinterSettings> {
    return this.printersService.saveSetting(dto);
  }

  @Delete('settings/:id')
  deleteSetting(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.printersService.deleteSetting(id);
  }

  @Post('test')
  async testPrint(@Body() body: { printer_ip?: string; printer_port?: number }) {
    // Test printing is now handled by Electron via IPC
    // This endpoint is kept for compatibility but returns a message
    return { 
      success: false, 
      message: 'Test printing is now handled by Electron. Please use the frontend test button.' 
    };
  }
}

