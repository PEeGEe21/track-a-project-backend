import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  Req,
  Patch,
  Headers,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/')
  findAllUserNotifications(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('type') type: string,
    @Query('status') status: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notificationsService.findAllUserNotifications(
      req.user,
      organizationId,
      page,
      limit,
      search,
      type,
      status,
    );
  }

  @Get('/notify-bar')
  findAll(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notificationsService.findAll(req.user, organizationId);
  }

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notificationsService.createNotification(
      req.user,
      createNotificationDto,
      organizationId,
    );
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id, @Req() req: any) {
    return this.notificationsService.markAsRead(req.user, +id);
  }

  @Patch('read-all')
  markAllAsRead(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notificationsService.markAllAsRead(req.user, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notificationsService.remove(req.user, +id);
  }

  // @Post()
  // create(@Body() dto: CreateNotificationDto) {
  //   return this.notificationsService.createNotification(dto);
  // }

  // @Get(':userId')
  // getUserNotifications(@Param('userId') userId: number) {
  //   return this.notificationsService.getUserNotifications(userId);
  // }

  // @Patch(':id/read')
  // markAsRead(@Param('id') id: number) {
  //   return this.notificationsService.markAsRead(id);
  // }

  // @Delete(':id')
  // delete(@Param('id') id: number) {
  //   return this.notificationsService.deleteNotification(id);
  // }
}
