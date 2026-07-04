import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// DTOs
class CreateDailyDealDto {
  product_id!: number;
  special_price!: number;
  date!: string;
}

class UpdateDailyDealDto {
  is_active?: number;
}

class CreateComboDto {
  combo_name!: string;
  combo_price!: number;
  product_ids!: number[];
  /** 0–6 مثل Date.getDay()؛ فارغ = كل الأيام */
  weekdays?: number[];
}

class UpdateComboDto {
  combo_name?: string;
  combo_price?: number;
  product_ids?: number[];
  is_active?: number;
  weekdays?: number[] | null;
}

class CreateScheduledOfferDto {
  product_id?: number;
  combo_id?: number;
  special_price!: number;
  start_datetime!: string;
  end_datetime!: string;
}

class UpdateScheduledOfferDto {
  special_price?: number;
  start_datetime?: string;
  end_datetime?: string;
  is_active?: number;
}

class SetFeaturedDto {
  product_id!: number;
  featured!: boolean;
}

class CreateHappyHourDto {
  product_id!: number;
  happy_hour_price!: number;
  time_start!: string;
  time_end!: string;
  weekdays?: number[];
}

class UpdateHappyHourDto {
  happy_hour_price?: number;
  time_start?: string;
  time_end?: string;
  is_active?: number;
  weekdays?: number[] | null;
}

@Controller('offers')
@UseGuards(AuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // ========== Daily Deals ==========
  @Post('daily-deals')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  createDailyDeal(@Body() dto: CreateDailyDealDto) {
    return this.offersService.createDailyDeal(dto);
  }

  @Get('daily-deals')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getAllDailyDeals() {
    return this.offersService.getAllDailyDeals();
  }

  @Get('daily-deals/active')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getActiveDailyDeal() {
    return this.offersService.getActiveDailyDeal();
  }

  @Get('daily-deals/by-date')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getDailyDealByDate(@Query('date') date: string) {
    return this.offersService.getDailyDealByDate(date);
  }

  @Put('daily-deals/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  updateDailyDeal(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDailyDealDto) {
    return this.offersService.updateDailyDeal(id, dto);
  }

  @Delete('daily-deals/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  deleteDailyDeal(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.deleteDailyDeal(id);
  }

  // ========== Combos ==========
  @Post('combos')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  createCombo(@Body() dto: CreateComboDto) {
    return this.offersService.createCombo(dto);
  }

  @Get('combos')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getAllCombos() {
    return this.offersService.getAllCombos();
  }

  @Get('combos/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getCombo(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.getCombo(id);
  }

  @Put('combos/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  updateCombo(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateComboDto) {
    return this.offersService.updateCombo(id, dto);
  }

  @Delete('combos/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  deleteCombo(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.deleteCombo(id);
  }

  // ========== Scheduled Offers ==========
  @Post('scheduled-offers')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  createScheduledOffer(@Body() dto: CreateScheduledOfferDto) {
    return this.offersService.createScheduledOffer(dto);
  }

  @Get('scheduled-offers')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getAllScheduledOffers() {
    return this.offersService.getAllScheduledOffers();
  }

  @Get('scheduled-offers/active')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getActiveScheduledOffers() {
    return this.offersService.getActiveScheduledOffers();
  }

  @Get('scheduled-offers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getScheduledOffer(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.getScheduledOffer(id);
  }

  @Put('scheduled-offers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  updateScheduledOffer(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduledOfferDto) {
    return this.offersService.updateScheduledOffer(id, dto);
  }

  @Delete('scheduled-offers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  deleteScheduledOffer(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.deleteScheduledOffer(id);
  }

  // ========== Featured Items ==========
  @Post('featured-items')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  setFeatured(@Body() dto: SetFeaturedDto) {
    return this.offersService.setFeatured(dto.product_id, dto.featured);
  }

  @Get('featured-items')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getAllFeaturedItems() {
    return this.offersService.getAllFeaturedItems();
  }

  @Get('featured-items/:product_id/check')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  isFeatured(@Param('product_id', ParseIntPipe) product_id: number) {
    return this.offersService.isFeatured(product_id);
  }

  // ========== Happy Hour ==========
  @Post('happy-hour')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  createHappyHour(@Body() dto: CreateHappyHourDto) {
    return this.offersService.createHappyHour(dto);
  }

  @Get('happy-hour')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getAllHappyHours() {
    return this.offersService.getAllHappyHours();
  }

  @Get('happy-hour/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getHappyHour(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.getHappyHour(id);
  }

  @Put('happy-hour/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  updateHappyHour(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHappyHourDto) {
    return this.offersService.updateHappyHour(id, dto);
  }

  @Delete('happy-hour/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  deleteHappyHour(@Param('id', ParseIntPipe) id: number) {
    return this.offersService.deleteHappyHour(id);
  }

  // ========== Helper endpoints ==========
  @Get('effective-price/:product_id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  getEffectivePrice(@Param('product_id', ParseIntPipe) product_id: number) {
    return this.offersService.getEffectivePrice(product_id);
  }
}

